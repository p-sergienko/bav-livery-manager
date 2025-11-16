import { FormEvent, useEffect, useRef, useState } from 'react';
import type { Resolution, Simulator } from '@/types/livery';
import { useLiveryStore } from '@/store/liveryStore';
import styles from './SettingsPage.module.css';

const classNames = (...tokens: Array<string | false>) => tokens.filter(Boolean).join(' ');

export const SettingsPage = () => {
    const settings = useLiveryStore((state) => state.settings);
    const updateSettings = useLiveryStore((state) => state.updateSettings);
    const [formState, setFormState] = useState(settings);
    const [status, setStatus] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
    const [detecting, setDetecting] = useState(false);
    const statusTimer = useRef<number | null>(null);

    useEffect(() => {
        setFormState(settings);
    }, [settings]);

    useEffect(() => {
        return () => {
            if (statusTimer.current) {
                window.clearTimeout(statusTimer.current);
            }
        };
    }, []);

    const showStatus = (message: string, tone: 'success' | 'error' = 'success') => {
        if (statusTimer.current) {
            window.clearTimeout(statusTimer.current);
        }
        setStatus({ message, tone });
        statusTimer.current = window.setTimeout(() => setStatus(null), 4000);
    };

    const handleBrowse = async (field: 'msfs2020Path' | 'msfs2024Path') => {
        const selected = await window.electronAPI?.openDirectoryDialog?.();
        if (selected) {
            setFormState((prev) => ({ ...prev, [field]: selected }));
        }
    };

    const handleToggle = (field: 'defaultResolution' | 'defaultSimulator', value: Resolution | Simulator) => {
        setFormState((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        await updateSettings(formState);
        showStatus('Settings saved successfully.');
    };

    const handleAutoDetect = async () => {
        if (!window.electronAPI?.detectSimPaths) {
            showStatus('Auto-detect is only available in the desktop app.', 'error');
            return;
        }

        setDetecting(true);
        try {
            const detected = await window.electronAPI.detectSimPaths();
            if (!detected) {
                showStatus('No simulator installations were found.', 'error');
                return;
            }

            const updates: Partial<typeof formState> = {};
            if (detected.msfs2020Path) updates.msfs2020Path = detected.msfs2020Path;
            if (detected.msfs2024Path) updates.msfs2024Path = detected.msfs2024Path;

            if (Object.keys(updates).length) {
                setFormState((prev) => ({ ...prev, ...updates }));
                showStatus('Detected simulator folders. Review and save to apply.');
            } else {
                showStatus('No simulator installations were found.', 'error');
            }
        } catch (error) {
            console.error('Auto-detect failed', error);
            showStatus('Unable to detect simulator folders.', 'error');
        } finally {
            setDetecting(false);
        }
    };

    return (
        <section className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Settings</h1>
                    <p className={styles.description}>Update your simulator paths and defaults.</p>
                </div>
                <button type="button" className={styles.autoDetectButton} onClick={handleAutoDetect} disabled={detecting}>
                    {detecting ? 'Detecting…' : 'Auto-detect paths'}
                </button>
            </header>

            <form className={styles.form} onSubmit={handleSubmit}>
                <label className={styles.pathInput}>
                    <span className={styles.label}>MSFS 2020 Community Folder</span>
                    <div className={styles.inputRow}>
                        <input value={formState.msfs2020Path} onChange={(e) => setFormState((prev) => ({ ...prev, msfs2020Path: e.target.value }))} />
                        <button type="button" onClick={() => handleBrowse('msfs2020Path')}>
                            Browse
                        </button>
                    </div>
                </label>

                <label className={styles.pathInput}>
                    <span className={styles.label}>MSFS 2024 Community Folder</span>
                    <div className={styles.inputRow}>
                        <input value={formState.msfs2024Path} onChange={(e) => setFormState((prev) => ({ ...prev, msfs2024Path: e.target.value }))} />
                        <button type="button" onClick={() => handleBrowse('msfs2024Path')}>
                            Browse
                        </button>
                    </div>
                </label>

                <div className={styles.selectionControls}>
                    <div className={styles.selectionGroup}>
                        <p className={styles.selectionLabel}>Default Resolution</p>
                        <div className={styles.toggleGroup}>
                            {(['4K', '8K'] as Resolution[]).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    className={classNames(styles.toggleButton, formState.defaultResolution === option && styles.toggleButtonActive)}
                                    onClick={() => handleToggle('defaultResolution', option)}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={styles.selectionGroup}>
                        <p className={styles.selectionLabel}>Default Simulator</p>
                        <div className={styles.toggleGroup}>
                            {(['FS20', 'FS24'] as Simulator[]).map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    className={classNames(styles.toggleButton, formState.defaultSimulator === option && styles.toggleButtonActive)}
                                    onClick={() => handleToggle('defaultSimulator', option)}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <button type="submit" className={styles.submitButton}>
                    Save Settings
                </button>
                {status && <p className={classNames(styles.status, status.tone === 'error' && styles.statusError)}>{status.message}</p>}
            </form>
        </section>
    );
};
