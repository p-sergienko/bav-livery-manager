import { useLiveryStore } from '@/store/liveryStore';
import styles from './DownloadProgress.module.css';

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const DownloadIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

export const DownloadProgress = () => {
    const downloadStates = useLiveryStore((state) => state.downloadStates);
    const entries = Object.entries(downloadStates);

    // Empty state - suggest downloading
    if (entries.length === 0) {
        return (
            <div className={styles.container}>
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>
                        <DownloadIcon />
                    </div>
                    <p className={styles.emptyText}>No active downloads</p>
                    <p className={styles.emptyHint}>Browse the catalog to find liveries</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <DownloadIcon />
                <span>Downloading</span>
                <span className={styles.badge}>{entries.length}</span>
            </div>

            <div className={styles.list}>
                {entries.map(([name, state]) => {
                    // Build compact info string: G-EUUD A320 FS20 8K
                    const infoParts = [
                        state.registration,
                        state.aircraft,
                        state.simulator,
                        state.resolution
                    ].filter(Boolean);

                    return (
                        <div key={name} className={styles.item}>
                            <div className={styles.itemHeader}>
                                <span className={styles.itemName} title={name}>
                                    {name}
                                </span>
                                <span className={styles.itemPercent}>
                                    {state.extracting ? 'Installing' : `${Math.round(state.progress)}%`}
                                </span>
                            </div>

                            {infoParts.length > 0 && (
                                <div className={styles.itemInfo}>
                                    {infoParts.join(' · ')}
                                </div>
                            )}

                            <div className={styles.progressTrack}>
                                <div
                                    className={`${styles.progressBar} ${state.extracting ? styles.progressBarExtracting : ''}`}
                                    style={{ width: `${state.progress}%` }}
                                />
                            </div>

                            <div className={styles.itemMeta}>
                                {state.extracting ? (
                                    <span className={styles.extractingText}>Extracting files...</span>
                                ) : state.downloaded !== undefined && state.total !== undefined ? (
                                    <>
                                        <span>{formatBytes(state.downloaded)}</span>
                                        <span className={styles.separator}>/</span>
                                        <span>{formatBytes(state.total)}</span>
                                    </>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
