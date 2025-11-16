import { useEffect, useState } from 'react';
import type { DownloadProgress, Livery, Resolution, Simulator } from '@/types/livery';
import styles from './LiveryCard.module.css';

interface LiveryCardProps {
    livery: Livery;
    defaultResolution: Resolution;
    defaultSimulator: Simulator;
    downloadState?: DownloadProgress;
    isInstalled: (resolution: Resolution, simulator: Simulator) => boolean;
    onDownload: (resolution: Resolution, simulator: Simulator) => Promise<boolean>;
    onUninstall: (resolution: Resolution, simulator: Simulator) => Promise<boolean>;
}

const resolutionOptions: Resolution[] = ['4K', '8K'];
const simulatorOptions: Simulator[] = ['FS20', 'FS24'];
const classNames = (...tokens: Array<string | false>) => tokens.filter(Boolean).join(' ');

const DownloadIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

const UninstallIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M6 18L18 6M6 6l12 12" />
    </svg>
);

export const LiveryCard = ({
    livery,
    defaultResolution,
    defaultSimulator,
    downloadState,
    isInstalled,
    onDownload,
    onUninstall
}: LiveryCardProps) => {
    const [resolution, setResolution] = useState<Resolution>(defaultResolution);
    const [simulator, setSimulator] = useState<Simulator>(defaultSimulator);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setResolution(defaultResolution);
    }, [defaultResolution]);

    useEffect(() => {
        setSimulator(defaultSimulator);
    }, [defaultSimulator]);

    const handleDownload = async () => {
        setBusy(true);
        try {
            await onDownload(resolution, simulator);
        } finally {
            setBusy(false);
        }
    };

    const handleUninstall = async () => {
        setBusy(true);
        try {
            await onUninstall(resolution, simulator);
        } finally {
            setBusy(false);
        }
    };

    const installed = isInstalled(resolution, simulator);
    const disableDownload = busy || Boolean(downloadState);
    const disableUninstall = busy || !installed;

    return (
        <article className={styles.card} aria-label={`${livery.name} livery`}>
            <div className={styles.imageContainer}>
                {downloadState && (
                    <div className={classNames(styles.overlay, downloadState.extracting ? styles.overlayExtracting : '')}>
                        <span>{downloadState.extracting ? 'Installing…' : 'Downloading…'}</span>
                        {!downloadState.extracting && (
                            <div className={styles.progressBar}>
                                <div className={styles.progressFill} style={{ width: `${downloadState.progress}%` }} />
                            </div>
                        )}
                    </div>
                )}

                <div className={styles.imageButtons}>
                    <button
                        type="button"
                        className={styles.iconButton}
                        onClick={handleDownload}
                        disabled={disableDownload}
                        aria-label={installed ? 'Reinstall livery' : 'Download livery'}
                    >
                        <DownloadIcon />
                    </button>
                    <button
                        type="button"
                        className={styles.iconButton}
                        onClick={handleUninstall}
                        disabled={disableUninstall}
                        aria-label="Uninstall livery"
                    >
                        <UninstallIcon />
                    </button>
                </div>

                {installed && <span className={styles.installedBadge}>INSTALLED</span>}

                {livery.preview ? (
                    <img className={styles.image} src={livery.preview} alt={`${livery.name} preview`} loading="lazy" />
                ) : (
                    <div className={styles.placeholder}>No preview available</div>
                )}
            </div>

            <div className={styles.content}>
                <div className={styles.titleRow}>
                    <div>
                        <p className={styles.developer}>{livery.developer}</p>
                        <h3 className={styles.title}>{livery.name}</h3>
                    </div>
                    {livery.version && <span className={styles.badge}>v{livery.version}</span>}
                </div>

                <dl className={styles.meta}>
                    <div>
                        <dt className={styles.metaLabel}>Aircraft</dt>
                        <dd className={styles.metaValue}>{livery.aircraftType || 'Unknown'}</dd>
                    </div>
                    {livery.engine && (
                        <div>
                            <dt className={styles.metaLabel}>Engine</dt>
                            <dd className={styles.metaValue}>{livery.engine}</dd>
                        </div>
                    )}
                    {livery.size && (
                        <div>
                            <dt className={styles.metaLabel}>Size</dt>
                            <dd className={styles.metaValue}>{livery.size}</dd>
                        </div>
                    )}
                </dl>

                <div className={styles.selectionControls}>
                    <div className={styles.selectionGroup}>
                        <p className={styles.selectionLabel}>Resolution</p>
                        <div className={styles.toggleGroup}>
                            {resolutionOptions.map((option) => (
                                <button
                                    key={option}
                                    className={classNames(styles.toggleButton, option === resolution && styles.toggleButtonActive)}
                                    onClick={() => setResolution(option)}
                                    type="button"
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={styles.selectionGroup}>
                        <p className={styles.selectionLabel}>Simulator</p>
                        <div className={styles.toggleGroup}>
                            {simulatorOptions.map((option) => (
                                <button
                                    key={option}
                                    className={classNames(styles.toggleButton, option === simulator && styles.toggleButtonActive)}
                                    onClick={() => setSimulator(option)}
                                    type="button"
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
};
