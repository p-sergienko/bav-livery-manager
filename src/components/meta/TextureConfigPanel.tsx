import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMetaManifestStore } from '@/store/metaManifestStore';
import type { MetaTextureCfgScanResult, MetaTextureCfgWriteResult } from '@/types/electron-api';
import styles from './TextureConfigPanel.module.css';

type ScanState = 'idle' | 'scanning' | 'done';

const TEXTURE_CFG_PLACEHOLDER = [
    '[fltsim]',
    'fallback.1=..\\..\\..\\..\\AircraftFolder\\texture',
    'fallback.2=..\\..\\..\\..\\AircraftFolder\\texture.White',
].join('\n');

export function MetaTextureConfigPanel() {
    const { liveries, selectedIds } = useMetaManifestStore();
    const selected = liveries.filter((l) => selectedIds.has(l.id) && !l.loadError);

    const selectedKey = useMemo(
        () => [...selectedIds].sort().join(','),
        [selectedIds]
    );

    const [scanState, setScanState] = useState<ScanState>('idle');
    const [scanResults, setScanResults] = useState<MetaTextureCfgScanResult[]>([]);
    const [content, setContent] = useState('');
    const [saving, setSaving] = useState(false);

    function saveButtonLabel() {
        if (saving) return 'Writing…';
        const count = `${selected.length} livery${selected.length !== 1 ? 's' : ''}`;
        return isEditMode ? `Save to ${count}` : `Write to ${count}`;
    }
    const [saveResults, setSaveResults] = useState<MetaTextureCfgWriteResult[] | null>(null);

    const doScan = useCallback(async (dirs: string[], signal: { cancelled: boolean }) => {
        setScanState('scanning');
        setSaveResults(null);
        try {
            const results = await window.electronAPI!.metaScanTextureCfg(dirs);
            if (signal.cancelled) return;
            const allHaveFile = results.every((r) => r.cfgPaths.length > 0);
            const allContentsMatch =
                allHaveFile &&
                results.every((r) => r.allMatch) &&
                new Set(results.map((r) => r.content ?? '')).size === 1;
            setScanResults(results);
            setContent(allContentsMatch ? (results[0].content ?? '') : '');
            setScanState('done');
        } catch {
            if (!signal.cancelled) setScanState('idle');
        }
    }, []);

    useEffect(() => {
        if (selected.length === 0) {
            setScanState('idle');
            setScanResults([]);
            setContent('');
            setSaveResults(null);
            return;
        }
        const signal = { cancelled: false };
        doScan(selected.map((l) => l.dirPath), signal);
        return () => { signal.cancelled = true; };
    // selectedKey is the stable derived value that represents selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedKey]);

    async function handleSave() {
        if (!content.trim() || selected.length === 0) return;
        setSaving(true);
        setSaveResults(null);
        const results = await window.electronAPI!.metaWriteTextureCfg(
            selected.map((l) => l.dirPath),
            content
        );
        setSaveResults(results);
        setSaving(false);
        const signal = { cancelled: false };
        await doScan(selected.map((l) => l.dirPath), signal);
    }

    if (selected.length === 0) {
        return (
            <div className={styles.empty}>
                <div className={styles.emptyIcon}>📄</div>
                <p>Select one or more liveries to scan for texture.cfg</p>
            </div>
        );
    }

    const allHaveFile = scanResults.length > 0 && scanResults.every((r) => r.cfgPaths.length > 0);
    const noneHaveFile = scanResults.length > 0 && scanResults.every((r) => r.cfgPaths.length === 0);
    const allContentsMatch =
        allHaveFile &&
        scanResults.every((r) => r.allMatch) &&
        new Set(scanResults.map((r) => r.content ?? '')).size === 1;
    const isEditMode = allContentsMatch;
    const missingCount = scanResults.filter((r) => r.cfgPaths.length === 0).length;
    const mismatchCount = scanResults.filter((r) => r.cfgPaths.length > 0 && !r.allMatch).length;
    const crossMismatch = scanState === 'done' && allHaveFile && !allContentsMatch;

    return (
        <div className={styles.panel}>
            {scanState === 'scanning' && (
                <div className={styles.statusBar}>
                    <span className={styles.statusSpin}>⟳</span> Scanning…
                </div>
            )}

            {scanState === 'done' && (
                <div className={`${styles.statusBar} ${isEditMode ? styles.statusOk : styles.statusWarn}`}>
                    {isEditMode ? (
                        <>✓ All {scanResults.length} liveries have identical texture.cfg — editing in place</>
                    ) : (
                        <>
                            ⚠ Mismatches detected
                            {missingCount > 0 && ` · ${missingCount} missing`}
                            {mismatchCount > 0 && ` · ${mismatchCount} internal conflict`}
                            {crossMismatch && ' · contents differ across liveries'}
                            {' '}— write a fresh file to all
                        </>
                    )}
                </div>
            )}

            {scanState === 'done' && scanResults.length > 0 && (
                <div className={styles.liveryList}>
                    {scanResults.map((r) => {
                        const status =
                            r.cfgPaths.length === 0 ? 'missing'
                            : !r.allMatch ? 'conflict'
                            : 'ok';
                        return (
                            <div key={r.liveryDir} className={styles.liveryRow}>
                                <span className={`${styles.statusDot} ${styles[`dot_${status}`]}`} />
                                <span className={styles.liveryName} title={r.liveryDir}>{r.dirName}</span>
                                <span className={styles.liveryMeta}>
                                    {r.cfgPaths.length === 0
                                        ? 'no texture.cfg found'
                                        : !r.allMatch
                                        ? `${r.cfgPaths.length} files · contents differ`
                                        : `${r.cfgPaths.length} file${r.cfgPaths.length !== 1 ? 's' : ''}`}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {scanState === 'done' && (
                <div className={styles.editorSection}>
                    <div className={styles.editorHeader}>
                        <span className={styles.editorLabel}>
                            {isEditMode ? 'texture.cfg' : 'New texture.cfg content'}
                        </span>
                        {!isEditMode && <span className={styles.freshTag}>fresh write</span>}
                    </div>
                    <textarea
                        className={styles.textarea}
                        value={content}
                        onChange={(e) => { setContent(e.target.value); setSaveResults(null); }}
                        placeholder={isEditMode ? '' : TEXTURE_CFG_PLACEHOLDER}
                        spellCheck={false}
                    />
                    <div className={styles.actions}>
                        <button
                            className={styles.saveBtn}
                            onClick={handleSave}
                            disabled={saving || !content.trim()}
                        >
                            {saveButtonLabel()}
                        </button>
                    </div>
                </div>
            )}

            {saveResults && (
                <div className={styles.results}>
                    <div className={styles.resultsHeader}>
                        {saveResults.filter((r) => r.success).length}/{saveResults.length} succeeded
                    </div>
                    {saveResults.map((r) => (
                        <div key={r.liveryDir} className={styles.resultRow}>
                            <span className={`${styles.resultIcon} ${r.success ? styles.resultOk : styles.resultErr}`}>
                                {r.success ? '✓' : '✗'}
                            </span>
                            <span className={styles.resultName}>{r.dirName}</span>
                            <span className={styles.resultPath}>{r.error ?? r.path ?? ''}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
