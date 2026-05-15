import { useMemo, useState } from 'react';
import { DownloadedLiveryCard } from '@/components/DownloadedLiveryCard';
import { DownloadedPackageCard } from '@/components/DownloadedPackageCard';
import { useLiveryStore } from '@/store/liveryStore';
import { usePackageStore } from '@/store/packageStore';
import { useLiveriesQuery } from '@/hooks/useLiveriesQuery';
import { usePackagesQuery } from '@/hooks/usePackagesQuery';
import type { InstalledLiveryRecord } from '@/types/electron-api';
import type { LiveryUpdate } from '@/types/livery';
import type { PackageUpdate } from '@/types/package';
import styles from './DownloadsPage.module.css';
import { Download } from 'react-feather';

type SimFilter = 'all' | 'FS20' | 'FS24';

const classNames = (...tokens: Array<string | false | undefined>) => tokens.filter(Boolean).join(' ');

const RefreshIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
);

const DOWNLOADS_PER_PAGE = 12;

export const DownloadsPage = () => {
    const installedLiveries = useLiveryStore((state) => state.installedLiveries);
    const { data: liveriesData } = useLiveriesQuery();
    const liveries = useMemo(() => liveriesData ?? [], [liveriesData]);
    const uninstallEntry = useLiveryStore((state) => state.uninstallEntry);
    const availableUpdates = useLiveryStore((state) => state.availableUpdates);
    const updateLivery = useLiveryStore((state) => state.updateLivery);
    const checkForUpdates = useLiveryStore((state) => state.checkForUpdates);
    const checkingUpdates = useLiveryStore((state) => state.checkingUpdates);

    const packageUpdates = usePackageStore((state) => state.availableUpdates);
    const updatePackage = usePackageStore((state) => state.updatePackage);
    const dismissPackageUpdate = usePackageStore((state) => state.dismissUpdate);
    const checkForPackageUpdates = usePackageStore((state) => state.checkForUpdates);
    const checkingPackageUpdates = usePackageStore((state) => state.checkingUpdates);
    const { data: packagesData } = usePackagesQuery();
    const packagesCatalog = useMemo(() => packagesData ?? [], [packagesData]);

    const packageUpdateKey = (u: PackageUpdate) => `${u.packageId}-${u.simulator ?? ''}`;

    const handlePackageUpdate = async (update: PackageUpdate) => {
        await updatePackage(update, packagesCatalog);
    };

    const handleUninstall = async (entry: InstalledLiveryRecord): Promise<void> => {
        await uninstallEntry(entry);
    };

    const handleUpdate = async (update: LiveryUpdate): Promise<void> => {
        await updateLivery(update, packagesCatalog);
    };

    const [page, setPage] = useState(1);
    const [updatingAll, setUpdatingAll] = useState(false);
    const [simFilter, setSimFilter] = useState<SimFilter>('all');

    // Composite key: liveryId + simulator, since one livery can be installed for both sims
    const updatesMap = useMemo(() => {
        const map = new Map<string, LiveryUpdate>();
        availableUpdates.forEach((u) => map.set(`${u.liveryId}-${u.simulator ?? ''}`, u));
        return map;
    }, [availableUpdates]);

    // Merge each update with its corresponding installed record matched by installPath (most precise)
    // or by liveryId + simulator as fallback.
    const allUpdateEntries = useMemo(() => {
        return availableUpdates.map((update) => {
            const livery = update.installPath
                ? installedLiveries.find((l) => l.installPath === update.installPath)
                : installedLiveries.find((l) => l.liveryId === update.liveryId && l.simulator === update.simulator);
            // Spread livery first so update fields (changelog, latestVersion, etc.) take priority
            return { ...livery, ...update };
        });
    }, [availableUpdates, installedLiveries]) as Array<InstalledLiveryRecord & LiveryUpdate>;

    const filterCounts = useMemo(() => ({
        all: allUpdateEntries.length,
        FS20: allUpdateEntries.filter((e) => e.simulator === 'FS20').length,
        FS24: allUpdateEntries.filter((e) => e.simulator === 'FS24').length,
    }), [allUpdateEntries]);

    const filteredLiveries = useMemo(() => {
        if (simFilter === 'all') return allUpdateEntries;
        return allUpdateEntries.filter((e) => e.simulator === simFilter);
    }, [allUpdateEntries, simFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredLiveries.length / DOWNLOADS_PER_PAGE));
    const paginated = filteredLiveries.slice((page - 1) * DOWNLOADS_PER_PAGE, page * DOWNLOADS_PER_PAGE);

    const pageNumbers = useMemo(() => {
        const pages: Array<number | 'ellipsis'> = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            const start = Math.max(2, page - 1);
            const end = Math.min(totalPages - 1, page + 1);
            if (start > 2) pages.push('ellipsis');
            for (let i = start; i <= end; i++) pages.push(i);
            if (end < totalPages - 1) pages.push('ellipsis');
            pages.push(totalPages);
        }
        return pages;
    }, [page, totalPages]);

    const handleUpdateAll = async () => {
        const toUpdate = simFilter === 'all' ? availableUpdates : availableUpdates.filter((u) => u.simulator === simFilter);
        if (toUpdate.length === 0) return;
        setUpdatingAll(true);
        try {
            for (const update of toUpdate) {
                await updateLivery(update, packagesCatalog);
            }
        } finally {
            setUpdatingAll(false);
        }
    };

    const handleSimFilterChange = (filter: SimFilter) => {
        setPage(1);
        setSimFilter(filter);
    };

    const visibleUpdateCount = simFilter === 'all' ? availableUpdates.length : filterCounts[simFilter];
    const totalAvailable = allUpdateEntries.length + packageUpdates.length;
    const anyChecking = checkingUpdates || checkingPackageUpdates;
    const refreshAll = () => {
        void checkForUpdates();
        void checkForPackageUpdates(packagesCatalog);
    };

    return (
        <section className={styles.page}>
            <header id="updatePage" className={styles.pageHeader}>
                <div className={styles.headerCopy}>
                    <h1 className={styles.pageHeaderText}>Updates</h1>
                    <p className={styles.headerSubtitle}>
                        {totalAvailable > 0 ? (
                            <span className={styles.updateCount}>
                                {totalAvailable} Update{totalAvailable === 1 ? '' : 's'} Available
                            </span>
                        ) : (
                            <span>Everything is up to date</span>
                        )}
                    </p>
                </div>

                <div className={styles.headerActions}>
                    {visibleUpdateCount > 0 && (
                        <button
                            className={styles.updateAllButton}
                            onClick={handleUpdateAll}
                            disabled={updatingAll || checkingUpdates}
                        >
                            <Download size={18}/>
                            {updatingAll ? 'Updating All…' : `Update All Liveries (${visibleUpdateCount})`}
                        </button>
                    )}
                    <button
                        className={classNames(styles.refreshButton, anyChecking && styles.refreshButtonSpin)}
                        onClick={refreshAll}
                        disabled={anyChecking}
                        aria-label="Check for updates"
                        title="Check for updates"
                    >
                        <RefreshIcon />
                    </button>
                </div>
            </header>

            {allUpdateEntries.length > 0 && (filterCounts.FS20 > 0 || filterCounts.FS24 > 0) && (
                <div className={styles.simFilterBar}>
                    {(['all', 'FS20', 'FS24'] as SimFilter[]).map((f) => {
                        const count = filterCounts[f];
                        if (f !== 'all' && count === 0) return null;
                        return (
                            <button
                                key={f}
                                className={classNames(styles.simFilterChip, simFilter === f && styles.simFilterChipActive)}
                                onClick={() => handleSimFilterChange(f)}
                            >
                                {f === 'all' ? 'All Simulators' : f === 'FS20' ? 'MSFS 2020' : 'MSFS 2024'}
                                <span className={styles.simFilterCount}>{count}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className={styles.scrollContainer}>
                <div className={styles.paginationBar}>
                    {totalPages > 1 && (
                        <div className={styles.paginationButtons}>
                            <button type="button" onClick={() => setPage((v) => Math.max(1, v - 1))} disabled={page === 1} aria-label="Previous page">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                                    <path d="M15 18l-6-6 6-6" />
                                </svg>
                            </button>
                            {pageNumbers.map((p, i) =>
                                p === 'ellipsis' ? (
                                    <span key={`e${i}`} className={styles.paginationEllipsis}>…</span>
                                ) : (
                                    <button
                                        key={p}
                                        type="button"
                                        className={classNames(styles.pageButton, p === page && styles.pageButtonActive)}
                                        onClick={() => setPage(p)}
                                    >
                                        {p}
                                    </button>
                                )
                            )}
                            <button type="button" onClick={() => setPage((v) => Math.min(totalPages, v + 1))} disabled={page === totalPages} aria-label="Next page">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

                <div className={styles.contentArea}>
                {packageUpdates.length > 0 && (
                    <section className={styles.updatesSection}>
                        <div className={styles.sectionHeader}>
                            <h2 className={styles.sectionTitle}>Package Updates</h2>
                            <span className={styles.sectionCount}>{packageUpdates.length}</span>
                        </div>
                        <div className={styles.grid}>
                            {packageUpdates.map((update) => {
                                const key = packageUpdateKey(update);
                                const packageMatch = packagesCatalog.find(
                                    (p) => p.id === update.packageId || p.slug === update.slug
                                );
                                return (
                                    <DownloadedPackageCard
                                        key={key}
                                        update={update}
                                        packageMatch={packageMatch}
                                        onUpdate={handlePackageUpdate}
                                        onDismiss={dismissPackageUpdate}
                                    />
                                );
                            })}
                        </div>
                    </section>
                )}

                {paginated.length > 0 && (
                    <section className={styles.updatesSection}>
                        {packageUpdates.length > 0 && (
                            <div className={styles.sectionHeader}>
                                <h2 className={styles.sectionTitle}>Livery Updates</h2>
                                <span className={styles.sectionCount}>{allUpdateEntries.length}</span>
                            </div>
                        )}
                        <div className={styles.grid}>
                            {paginated.map((entry) => {
                                const liveryMatch = liveries.find((l) => l.id === entry.liveryId || l.name === entry.originalName);
                                const update = updatesMap.get(`${entry.liveryId}-${entry.simulator ?? ''}`);

                                return (
                                    <DownloadedLiveryCard
                                        key={entry.installPath ?? `${entry.liveryId}-${entry.simulator}`}
                                        entry={entry}
                                        liveryMatch={liveryMatch}
                                        update={update}
                                        onUninstall={handleUninstall}
                                        onUpdate={handleUpdate}
                                    />
                                );
                            })}
                        </div>
                    </section>
                )}

                {paginated.length === 0 && packageUpdates.length === 0 && (
                    <div className={styles.emptyState}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <p>Nothing pending — your liveries and packages are up to date.</p>
                    </div>
                )}
                </div>
            </div>
        </section>
    );
};
