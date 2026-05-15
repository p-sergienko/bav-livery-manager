import { useMemo, useState } from 'react';
import { useLiveryStore } from '@/store/liveryStore';
import { usePackageStore } from '@/store/packageStore';
import { usePackagesQuery } from '@/hooks/usePackagesQuery';
import type { LiveryUpdate } from '@/types/livery';
import type { PackageUpdate } from '@/types/package';
import styles from './UpdateNotification.module.css';

type CombinedUpdate =
    | { kind: 'livery'; key: string; update: LiveryUpdate }
    | { kind: 'package'; key: string; update: PackageUpdate };

const UpdateIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
);

const CloseIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

export const UpdateNotification = () => {
    const liveryUpdates = useLiveryStore((state) => state.availableUpdates);
    const updateLivery = useLiveryStore((state) => state.updateLivery);
    const dismissLiveryUpdate = useLiveryStore((state) => state.dismissUpdate);
    const checkForLiveryUpdates = useLiveryStore((state) => state.checkForUpdates);
    const checkingLiveryUpdates = useLiveryStore((state) => state.checkingUpdates);

    const packageUpdates = usePackageStore((state) => state.availableUpdates);
    const updatePackage = usePackageStore((state) => state.updatePackage);
    const dismissPackageUpdate = usePackageStore((state) => state.dismissUpdate);
    const checkForPackageUpdates = usePackageStore((state) => state.checkForUpdates);
    const checkingPackageUpdates = usePackageStore((state) => state.checkingUpdates);

    const { data: packagesData } = usePackagesQuery();
    const packagesCatalog = useMemo(() => packagesData ?? [], [packagesData]);

    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [updatingKeys, setUpdatingKeys] = useState<Set<string>>(new Set());

    const liveryKey = (u: LiveryUpdate) => `livery:${u.liveryId}-${u.simulator ?? ''}`;
    const packageKey = (u: PackageUpdate) => `package:${u.packageId}-${u.simulator ?? ''}`;

    const combined: CombinedUpdate[] = useMemo(() => {
        const packages: CombinedUpdate[] = packageUpdates.map((u) => ({ kind: 'package', key: packageKey(u), update: u }));
        const liveries: CombinedUpdate[] = liveryUpdates.map((u) => ({ kind: 'livery', key: liveryKey(u), update: u }));
        return [...packages, ...liveries];
    }, [liveryUpdates, packageUpdates]);

    const totalCount = combined.length;
    const checking = checkingLiveryUpdates || checkingPackageUpdates;

    const refreshAll = () => {
        void checkForLiveryUpdates();
        void checkForPackageUpdates(packagesCatalog);
    };

    const handleUpdate = async (item: CombinedUpdate) => {
        setUpdatingKeys((prev) => new Set(prev).add(item.key));
        try {
            if (item.kind === 'livery') {
                await updateLivery(item.update, packagesCatalog);
            } else {
                await updatePackage(item.update, packagesCatalog);
            }
        } finally {
            setUpdatingKeys((prev) => {
                const next = new Set(prev);
                next.delete(item.key);
                return next;
            });
        }
    };

    const handleDismiss = (item: CombinedUpdate, event: React.MouseEvent) => {
        event.stopPropagation();
        if (item.kind === 'livery') {
            dismissLiveryUpdate(item.update.liveryId);
        } else {
            dismissPackageUpdate(item.update.slug, item.update.simulator);
        }
    };

    const toggleExpand = (key: string) => {
        setExpandedKey(expandedKey === key ? null : key);
    };

    if (totalCount === 0 && !checking) {
        return null;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <UpdateIcon />
                    <h3 className={styles.title}>
                        {checking
                            ? 'Checking for updates...'
                            : `${totalCount} update${totalCount === 1 ? '' : 's'} available`}
                    </h3>
                </div>
                <button
                    className={styles.refreshButton}
                    onClick={refreshAll}
                    disabled={checking}
                    aria-label="Check for updates"
                    title="Check for updates"
                >
                    <UpdateIcon />
                </button>
            </div>

            {totalCount > 0 && (
                <div className={styles.updateList}>
                    {combined.map((item) => {
                        const isExpanded = expandedKey === item.key;
                        const isUpdating = updatingKeys.has(item.key);
                        const name = item.kind === 'livery'
                            ? item.update.liveryName
                            : item.update.packageTitle ?? item.update.slug;
                        const label = item.kind === 'package' ? `📦 ${name}` : name;

                        return (
                            <div key={item.key} className={styles.updateItem}>
                                <div
                                    className={styles.updateHeader}
                                    onClick={() => toggleExpand(item.key)}
                                >
                                    <div className={styles.updateInfo}>
                                        <span className={styles.liveryName}>{label}</span>
                                        <span className={styles.versionInfo}>
                                            {item.update.currentVersion} → {item.update.latestVersion}
                                        </span>
                                    </div>
                                    <button
                                        className={styles.dismissButton}
                                        onClick={(e) => handleDismiss(item, e)}
                                        aria-label="Dismiss update"
                                        title="Dismiss"
                                    >
                                        <CloseIcon />
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className={styles.updateDetails}>
                                        {item.update.changelog && (
                                            <div className={styles.changelog}>
                                                <p className={styles.changelogLabel}>What's new:</p>
                                                <p className={styles.changelogText}>{item.update.changelog}</p>
                                            </div>
                                        )}

                                        <div className={styles.metadata}>
                                            {item.kind === 'livery' && item.update.resolution && (
                                                <span className={styles.metaItem}>Resolution: {item.update.resolution}</span>
                                            )}
                                            {item.update.simulator && (
                                                <span className={styles.metaItem}>Simulator: {item.update.simulator}</span>
                                            )}
                                        </div>

                                        <button
                                            className={styles.updateButton}
                                            onClick={() => handleUpdate(item)}
                                            disabled={isUpdating}
                                        >
                                            {isUpdating ? 'Updating...' : 'Update Now'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
