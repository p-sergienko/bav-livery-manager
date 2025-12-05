import { useState } from 'react';
import type { InstalledLiveryRecord } from '@/types/electron-api';
import type { Livery } from '@/types/livery';
import { formatDate } from '@/utils/livery';
import styles from './DownloadedLiveryCard.module.css';

interface DownloadedLiveryCardProps {
    entry: InstalledLiveryRecord;
    liveryMatch?: Livery;
    onUninstall: (entry: InstalledLiveryRecord) => Promise<void>;
}

const classNames = (...tokens: Array<string | false>) => tokens.filter(Boolean).join(' ');

const UninstallIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
);

export const DownloadedLiveryCard = ({ entry, liveryMatch, onUninstall }: DownloadedLiveryCardProps) => {
    const [busy, setBusy] = useState(false);

    const handleUninstall = async () => {
        setBusy(true);
        try {
            await onUninstall(entry);
        } finally {
            setBusy(false);
        }
    };

    const preview = liveryMatch?.preview;
    const aircraftTitle = liveryMatch?.aircraftProfileName ?? 'Unknown aircraft';
    const developer = liveryMatch?.developerName ?? 'Unknown developer';
    const simulatorLabel = (entry.simulator ?? 'Unknown').toUpperCase();
    
    const engineType = liveryMatch?.engine ?? 'Unknown';
    const category = liveryMatch?.categoryName ?? 'Unknown';
    const year = liveryMatch?.year ? String(liveryMatch.year) : '—';
    
    // Format install date as DD.MM.YYYY
    const formatInstallDate = (dateString: string) => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    };

    return (
        <article className={styles.card} aria-label={`${entry.originalName} installed livery`}>
            <div className={styles.imageContainer}>
                <span className={styles.installedBadge}>INSTALLED</span>
                <span className={styles.simulatorBadge}>{simulatorLabel}</span>

                {preview ? (
                    <img className={styles.image} src={preview} alt={`${entry.originalName} preview`} loading="lazy" />
                ) : (
                    <div className={styles.placeholder}>No preview available</div>
                )}
            </div>

            <div className={styles.content}>
                <div className={styles.titleRow}>
                    <div>
                        <p className={styles.developer}>{developer}</p>
                        <h3 className={styles.title}>{entry.originalName}</h3>
                    </div>
                    {liveryMatch?.version && <span className={styles.badge}>v{liveryMatch.version}</span>}
                </div>

                <dl className={styles.meta}>
                    <div>
                        <dt className={styles.metaLabel}>Aircraft</dt>
                        <dd className={styles.metaValue}>{aircraftTitle}</dd>
                    </div>
                    <div>
                        <dt className={styles.metaLabel}>Resolution</dt>
                        <dd className={styles.metaValue}>{entry.resolution ?? 'Unknown'}</dd>
                    </div>
                    <div>
                        <dt className={styles.metaLabel}>Installed</dt>
                        <dd className={styles.metaValue}>{formatInstallDate(entry.installDate)}</dd>
                    </div>
                    <div>
                        <dt className={styles.metaLabel}>Engine</dt>
                        <dd className={styles.metaValue}>{engineType}</dd>
                    </div>
                    <div>
                        <dt className={styles.metaLabel}>Category</dt>
                        <dd className={styles.metaValue}>{category}</dd>
                    </div>
                    <div>
                        <dt className={styles.metaLabel}>Year</dt>
                        <dd className={styles.metaValue}>{year}</dd>
                    </div>
                    <div className={styles.directoryField}>
                        <dt className={styles.metaLabel}>Directory</dt>
                        <dd className={styles.metaValue} title={entry.installPath}>{entry.folderName}</dd>
                    </div>
                </dl>

                <div className={styles.actions}>
                    <button
                        className={classNames(styles.uninstallButton, busy && styles.uninstallButtonBusy)}
                        onClick={handleUninstall}
                        disabled={busy}
                        aria-label={`Uninstall ${entry.originalName}`}
                    >
                        <UninstallIcon />
                        {busy ? 'Removing…' : 'Uninstall'}
                    </button>
                </div>
            </div>
        </article>
    );
};
