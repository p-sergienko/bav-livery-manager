import { useState } from 'react';
import type { Package, PackageUpdate } from '@/types/package';
import { usePackageStore } from '@/store/packageStore';
import { formatBytes } from '@/utils/formatBytes';
import styles from './DownloadedLiveryCard.module.css';

interface DownloadedPackageCardProps {
    update: PackageUpdate;
    packageMatch?: Package;
    onUpdate: (update: PackageUpdate) => Promise<void>;
    onDismiss: (slug: string, simulator?: string) => void;
}

const classNames = (...tokens: Array<string | false | undefined>) => tokens.filter(Boolean).join(' ');

const PackageIcon = () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
);

const UpdateIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
);

const DismissIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

export const DownloadedPackageCard = ({ update, packageMatch, onUpdate, onDismiss }: DownloadedPackageCardProps) => {
    const [updating, setUpdating] = useState(false);
    const downloadState = usePackageStore((state) => state.downloadStates[update.slug]);
    const isDownloading = Boolean(downloadState);
    const overlayProgress = Math.round(downloadState?.progress ?? 0);
    const overlayExtracting = downloadState?.extracting ?? false;
    const overlayDownloaded = downloadState?.downloaded;
    const overlayTotal = downloadState?.total;

    const handleUpdate = async () => {
        setUpdating(true);
        try {
            await onUpdate(update);
        } finally {
            setUpdating(false);
        }
    };

    const handleDismiss = () => {
        onDismiss(update.slug, update.simulator);
    };

    const preview = packageMatch?.previewUrl;
    const title = update.packageTitle ?? packageMatch?.title ?? update.slug;
    const category = packageMatch?.category ?? 'Package';
    const aircraft = packageMatch?.aircraftProfileName ?? '—';
    const simulatorLabel = (update.simulator ?? packageMatch?.simulatorCode ?? '').toUpperCase();

    return (
        <article className={styles.card} aria-label={`${title} update`}>
            <div className={styles.imageContainer}>
                {simulatorLabel && <span className={styles.simulatorBadge}>{simulatorLabel}</span>}
                {!isDownloading && <span className={styles.updateBadge}>Update</span>}

                {preview ? (
                    <img className={styles.image} src={preview} alt={`${title} preview`} loading="lazy" />
                ) : (
                    <div className={styles.placeholder}>
                        <PackageIcon />
                        <span>Package</span>
                    </div>
                )}

                {downloadState && (
                    <div className={classNames(styles.overlay, overlayExtracting && styles.overlayExtracting)}>
                        {overlayExtracting ? (
                            <>
                                <div className={styles.overlaySpinner} />
                                <span className={styles.overlayTitle}>Installing…</span>
                                <span className={styles.overlaySubtitle}>Extracting files</span>
                            </>
                        ) : (
                            <>
                                <span className={styles.overlayTitle}>Updating…</span>
                                <span className={styles.overlayPercent}>{overlayProgress}%</span>
                                <div className={styles.overlayProgressBar}>
                                    <div className={styles.overlayProgressFill} style={{ width: `${overlayProgress}%` }} />
                                </div>
                                {overlayDownloaded && overlayTotal ? (
                                    <span className={styles.overlaySubtitle}>
                                        {formatBytes(overlayDownloaded)} / {formatBytes(overlayTotal)}
                                    </span>
                                ) : null}
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className={styles.content}>
                <div className={styles.titleRow}>
                    <div>
                        <p className={styles.developer}>{category}</p>
                        <h3 className={styles.title}>{title}</h3>
                    </div>
                </div>

                <dl className={styles.meta}>
                    <div>
                        <dt className={styles.metaLabel}>Aircraft</dt>
                        <dd className={styles.metaValue}>{aircraft}</dd>
                    </div>
                    <div>
                        <dt className={styles.metaLabel}>Type</dt>
                        <dd className={styles.metaValue}>Package</dd>
                    </div>
                    <div>
                        <dt className={styles.metaLabel}>Simulator</dt>
                        <dd className={styles.metaValue}>{simulatorLabel || '—'}</dd>
                    </div>
                </dl>

                <div className={styles.updateInfo}>
                    <div className={styles.updateVersions}>
                        <span className={styles.versionOld}>v{update.currentVersion}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                            <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                        <span className={styles.versionNew}>v{update.latestVersion}</span>
                    </div>
                    {update.changelog && <p className={styles.changelog}>{update.changelog}</p>}
                </div>

                <div className={styles.actions}>
                    <button
                        type="button"
                        className={classNames(styles.updateButton, (updating || isDownloading) && styles.updateButtonBusy)}
                        onClick={handleUpdate}
                        disabled={updating || isDownloading}
                        aria-label={`Update ${title}`}
                    >
                        <UpdateIcon />
                        {updating || isDownloading ? 'Updating…' : 'Update'}
                    </button>
                    <button
                        type="button"
                        className={styles.uninstallButton}
                        onClick={handleDismiss}
                        disabled={updating || isDownloading}
                        aria-label={`Dismiss update for ${title}`}
                    >
                        <DismissIcon />
                        Dismiss
                    </button>
                </div>
            </div>
        </article>
    );
};
