import { useEffect, useMemo, useState } from 'react';
import type { DownloadProgress, Livery, Resolution, Simulator } from '@/types/livery';
import { useLiveryStore } from '@/store/liveryStore';
import styles from './LiveryCard.module.css';

interface LiveryCardProps {
    livery: Livery;
    defaultResolution: Resolution;
    defaultSimulator: Simulator;
    resolutionFilter?: Resolution | 'all';
    downloadState?: DownloadProgress;
    isInstalled: (resolution: Resolution, simulator: Simulator) => boolean;
    onDownload: (resolution: Resolution, simulator: Simulator) => Promise<boolean>;
    onUninstall: (resolution: Resolution, simulator: Simulator) => Promise<boolean>;
}

const classNames = (...tokens: Array<string | false>) => tokens.filter(Boolean).join(' ');

const formatSize = (size?: string | number | null) => {
    if (typeof size === 'number') {
        const mb = size / (1024 * 1024);
        return `${mb >= 0.1 ? mb.toFixed(1) : mb.toFixed(2)} MB`;
    }
    if (typeof size === 'string' && size.trim()) {
        return size;
    }
    return '';
};

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
    resolutionFilter,
    downloadState,
    isInstalled,
    onDownload,
    onUninstall
}: LiveryCardProps) => {
    const allLiveries = useLiveryStore((state) => state.liveries);
    const [simulator, setSimulator] = useState<Simulator>(defaultSimulator);
    const [busy, setBusy] = useState(false);
    const [selectedResolution, setSelectedResolution] = useState<Resolution | null>(null);
    const isResolutionForced = Boolean(resolutionFilter && resolutionFilter !== 'all');

    useEffect(() => {
        setSimulator(defaultSimulator);
    }, [defaultSimulator]);

    useEffect(() => {
        if (resolutionFilter && resolutionFilter !== 'all') {
            setSelectedResolution(resolutionFilter);
            return;
        }
        setSelectedResolution(null);
    }, [resolutionFilter]);

    const peerResolutions = useMemo(() => {
        const title = (livery.title || livery.name || '').trim().toLowerCase();
        const matches = allLiveries.filter((entry) => {
            const entryTitle = (entry.title || entry.name || '').trim().toLowerCase();
            return (
                entry.developerId === livery.developerId &&
                entry.aircraftProfileId === livery.aircraftProfileId &&
                entry.simulatorId === livery.simulatorId &&
                entryTitle === title
            );
        });

        const map = new Map<Resolution, { resolution: Resolution; size?: string | number | null }>();
        matches.forEach((entry) => {
            const res = (entry.resolutionValue as Resolution) ?? null;
            if (!res) return;
            if (!map.has(res)) {
                map.set(res, { resolution: res, size: entry.size });
            }
        });

        if (!map.size) {
            map.set(livery.resolutionValue as Resolution, { resolution: livery.resolutionValue as Resolution, size: livery.size });
        }

        return Array.from(map.values()).sort((a, b) => a.resolution.localeCompare(b.resolution));
    }, [allLiveries, livery]);

    const handleDownload = async (res: Resolution) => {
        setSelectedResolution(res);
        setBusy(true);
        try {
            await onDownload(res, simulator);
        } finally {
            setBusy(false);
        }
    };

    const handleUninstall = async (res: Resolution) => {
        setSelectedResolution(res);
        setBusy(true);
        try {
            await onUninstall(res, simulator);
        } finally {
            setBusy(false);
        }
    };

    const installedAny = peerResolutions.some((variant) => isInstalled(variant.resolution, simulator));
    const disableDownload = busy || Boolean(downloadState);

    const showAllResolutions = selectedResolution === null && !isResolutionForced;
    const resolutionsToRender = showAllResolutions
        ? peerResolutions
        : peerResolutions.filter((variant) => variant.resolution === selectedResolution);

    const resolutionPills = peerResolutions.map((variant) => variant.resolution);

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

                {installedAny && <span className={styles.installedBadge}>INSTALLED</span>}

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
                        <dd className={styles.metaValue}>{livery.aircraftType || livery.aircraftProfileName || 'Unknown'}</dd>
                    </div>
                    <div>
                        <dt className={styles.metaLabel}>Developer</dt>
                        <dd className={styles.metaValue}>{livery.developer || livery.developerName}</dd>
                    </div>
                    {livery.engine && (
                        <div>
                            <dt className={styles.metaLabel}>Engine</dt>
                            <dd className={styles.metaValue}>{livery.engine}</dd>
                        </div>
                    )}
                </dl>
                <dl className={styles.metaSecond}>
                    <div>
                        <dt className={styles.metaLabel}>Year</dt>
                        <dd className={styles.metaValue}>{livery.year ?? '—'}</dd>
                    </div>
                    <div>
                        <dt className={styles.metaLabel}>Category</dt>
                        <dd className={styles.metaValue}>{livery.categoryName ?? 'Uncategorized'}</dd>
                    </div>
                </dl>

                <div className={styles.selectionControls}>
                    <div className={styles.selectionGroup}>
                        <div className={styles.downloadRow}>
                            {resolutionsToRender.map((variant) => {
                                const res = variant.resolution;
                                const sizeLabel = formatSize(variant.size || livery.size);
                                const isInstalledVariant = isInstalled(res, simulator);
                                const disableVariantUninstall = busy || !isInstalledVariant;
                                const label = sizeLabel ? `${res} (${sizeLabel})` : res;
                                return (
                                    <div key={res} className={styles.downloadChip}>
                                        <button
                                            type="button"
                                            className={classNames(styles.downloadButton, selectedResolution === res && styles.downloadButtonActive)}
                                            disabled={disableDownload}
                                            onClick={() => handleDownload(res)}
                                        >
                                            <span className={styles.buttonIcon} aria-hidden>
                                                <DownloadIcon />
                                            </span>
                                            <span className={styles.btnLabelFull}>Download {label}</span>
                                            <span className={styles.btnLabelShort}>{label}</span>
                                        </button>
                                        {isInstalledVariant && (
                                            <button
                                                type="button"
                                                className={styles.uninstallButton}
                                                disabled={disableVariantUninstall}
                                                onClick={() => handleUninstall(res)}
                                            >
                                                <span className={styles.buttonIcon} aria-hidden>
                                                    <UninstallIcon />
                                                </span>
                                                <span>Uninstall</span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
};
