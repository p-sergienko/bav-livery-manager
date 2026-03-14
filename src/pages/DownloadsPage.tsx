import { useMemo, useState } from 'react';
import { DownloadedLiveryCard } from '@/components/DownloadedLiveryCard';
import { useLiveryStore } from '@/store/liveryStore';
import type { InstalledLiveryRecord } from '@/types/electron-api';
import type { LiveryUpdate } from '@/types/livery';
import styles from './DownloadsPage.module.css';

type FilterKey = 'developer' | 'aircraft' | 'resolution' | 'simulator';
type SortKey = 'name' | 'date' | 'developer' | 'aircraft';

const baseFilters: Record<FilterKey, string> = {
    developer: 'all',
    aircraft: 'all',
    resolution: 'all',
    simulator: 'all'
};

interface ChipOption {
    value: string;
    label: string;
    hint?: string | null;
}

interface QuickFilterGroup {
    key: FilterKey;
    label: string;
    options: ChipOption[];
    limit?: number;
}

const classNames = (...tokens: Array<string | false | undefined>) => tokens.filter(Boolean).join(' ');

const SearchIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M11 3a8 8 0 0 1 8 8c0 1.848-.627 3.55-1.68 4.905l3.386 3.388a1 1 0 0 1-1.414 1.414l-3.388-3.386A7.96 7.96 0 0 1 11 19a8 8 0 1 1 0-16z" />
    </svg>
);

const UpdateIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
);

const RefreshIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
);

const DOWNLOADS_PER_PAGE = 12;

export const DownloadsPage = () => {
    const installedLiveries = useLiveryStore((state) => state.installedLiveries);
    const liveries = useLiveryStore((state) => state.liveries);
    const uninstallEntry = useLiveryStore((state) => state.uninstallEntry);
    const availableUpdates = useLiveryStore((state) => state.availableUpdates);
    const updateLivery = useLiveryStore((state) => state.updateLivery);
    const checkForUpdates = useLiveryStore((state) => state.checkForUpdates);
    const checkingUpdates = useLiveryStore((state) => state.checkingUpdates);

    const handleUninstall = async (entry: InstalledLiveryRecord): Promise<void> => {
        await uninstallEntry(entry);
    };

    const handleUpdate = async (update: LiveryUpdate): Promise<void> => {
        await updateLivery(update);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState(baseFilters);
    const [page, setPage] = useState(1);
    const [sort, setSort] = useState<SortKey>('date');
    const [updatingAll, setUpdatingAll] = useState(false);
    const [showUpdatesOnly, setShowUpdatesOnly] = useState(false);

    const managedEntries = useMemo(
        () => installedLiveries.filter((entry) => entry.originalName),
        [installedLiveries]
    );

    // Map of liveryId to update
    const updatesMap = useMemo(() => {
        const map = new Map<string, LiveryUpdate>();
        availableUpdates.forEach((u) => map.set(u.liveryId, u));
        return map;
    }, [availableUpdates]);

    const quickFilterGroups = useMemo<QuickFilterGroup[]>(() => {
        const developers = new Map<string, number>();
        const aircraft = new Map<string, number>();
        const resolutions = new Map<string, number>();
        const simulators = new Map<string, number>();

        managedEntries.forEach((entry) => {
            const catalogMatch = liveries.find((l) => l.name === entry.originalName);
            const dev = catalogMatch?.developerName;
            const air = catalogMatch?.aircraftProfileName;

            if (dev) developers.set(dev, (developers.get(dev) ?? 0) + 1);
            if (air) aircraft.set(air, (aircraft.get(air) ?? 0) + 1);
            if (entry.resolution) resolutions.set(entry.resolution, (resolutions.get(entry.resolution) ?? 0) + 1);
            if (entry.simulator) simulators.set(entry.simulator, (simulators.get(entry.simulator) ?? 0) + 1);
        });

        const groups: QuickFilterGroup[] = [];

        if (simulators.size) {
            groups.push({
                key: 'simulator',
                label: 'Simulators',
                options: Array.from(simulators.entries())
                    .map(([value, count]) => ({ value, label: value, hint: `${count}` }))
                    .sort((a, b) => a.label.localeCompare(b.label))
            });
        }

        if (aircraft.size) {
            groups.push({
                key: 'aircraft',
                label: 'Aircraft',
                options: Array.from(aircraft.entries())
                    .map(([value, count]) => ({ value, label: value, hint: `${count}` }))
                    .sort((a, b) => a.label.localeCompare(b.label)),
                limit: 6
            });
        }

        if (resolutions.size) {
            groups.push({
                key: 'resolution',
                label: 'Resolutions',
                options: Array.from(resolutions.entries())
                    .map(([value, count]) => ({ value, label: value, hint: `${count}` }))
                    .sort((a, b) => a.label.localeCompare(b.label))
            });
        }

        if (developers.size) {
            groups.push({
                key: 'developer',
                label: 'Developers',
                options: Array.from(developers.entries())
                    .map(([value, count]) => ({ value, label: value, hint: `${count}` }))
                    .sort((a, b) => a.label.localeCompare(b.label)),
                limit: 6
            });
        }

        return groups;
    }, [managedEntries, liveries]);

    const filtered = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return managedEntries.filter((entry) => {
            const catalogMatch = liveries.find((l) => l.name === entry.originalName);
            const developer = catalogMatch?.developerName ?? '';
            const manufacturer = catalogMatch?.manufacturer ?? '';
            const aircraftName = catalogMatch?.aircraftProfileName ?? '';

            const haystack = [
                entry.folderName,
                entry.originalName,
                entry.simulator,
                entry.resolution,
                developer,
                manufacturer,
                aircraftName
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            const matchesSearch = haystack.includes(term);
            const matchesDeveloper = filters.developer === 'all' || developer === filters.developer;
            const matchesAircraft = filters.aircraft === 'all' || aircraftName === filters.aircraft;
            const matchesResolution = filters.resolution === 'all' || entry.resolution === filters.resolution;
            const matchesSimulator = filters.simulator === 'all' || entry.simulator === filters.simulator;
            const matchesUpdatesOnly = !showUpdatesOnly || updatesMap.has(entry.liveryId);

            return matchesSearch && matchesDeveloper && matchesAircraft && matchesResolution && matchesSimulator && matchesUpdatesOnly;
        });
    }, [managedEntries, liveries, searchTerm, filters, showUpdatesOnly, updatesMap]);

    const sorted = useMemo(() => {
        const items = [...filtered];
        // Always put items with updates first
        items.sort((a, b) => {
            const aHasUpdate = updatesMap.has(a.liveryId) ? 0 : 1;
            const bHasUpdate = updatesMap.has(b.liveryId) ? 0 : 1;
            if (aHasUpdate !== bHasUpdate) return aHasUpdate - bHasUpdate;

            const aCatalog = liveries.find((l) => l.name === a.originalName);
            const bCatalog = liveries.find((l) => l.name === b.originalName);

            switch (sort) {
                case 'name':
                    return (a.originalName ?? '').localeCompare(b.originalName ?? '');
                case 'date':
                    return new Date(b.installDate).getTime() - new Date(a.installDate).getTime();
                case 'developer':
                    return (aCatalog?.developerName ?? '').localeCompare(bCatalog?.developerName ?? '');
                case 'aircraft':
                    return (aCatalog?.aircraftProfileName ?? '').localeCompare(bCatalog?.aircraftProfileName ?? '');
                default:
                    return 0;
            }
        });
        return items;
    }, [filtered, sort, liveries, updatesMap]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / DOWNLOADS_PER_PAGE));
    const paginated = sorted.slice((page - 1) * DOWNLOADS_PER_PAGE, page * DOWNLOADS_PER_PAGE);

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

    const startItem = (page - 1) * DOWNLOADS_PER_PAGE + 1;
    const endItem = Math.min(page * DOWNLOADS_PER_PAGE, sorted.length);

    const updateFilter = (key: FilterKey, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const handleQuickSelect = (key: FilterKey, value: string) => {
        updateFilter(key, filters[key] === value ? 'all' : value);
    };

    const handleUpdateAll = async () => {
        if (availableUpdates.length === 0) return;
        setUpdatingAll(true);
        try {
            for (const update of availableUpdates) {
                await updateLivery(update);
            }
        } finally {
            setUpdatingAll(false);
        }
    };

    const activeFilterCount = Object.values(filters).filter((v) => v !== 'all').length + (showUpdatesOnly ? 1 : 0);

    const clearAllFilters = () => {
        setFilters(baseFilters);
        setShowUpdatesOnly(false);
        setSearchTerm('');
        setPage(1);
    };

    return (
        <section className={styles.page}>
            <header className={styles.pageHeader}>
                <div className={styles.headerCopy}>
                    <h1>My Downloads</h1>
                    <p className={styles.headerSubtitle}>
                        {sorted.length} {sorted.length === 1 ? 'livery ' : 'liveries '}
                        {availableUpdates.length > 0 && (
                            <span className={styles.updateCount}>
                                · {availableUpdates.length} update{availableUpdates.length === 1 ? '' : 's'}
                            </span>
                        )}
                    </p>
                </div>

                <div className={styles.headerActions}>
                    {availableUpdates.length > 0 && (
                        <button
                            className={styles.updateAllButton}
                            onClick={handleUpdateAll}
                            disabled={updatingAll || checkingUpdates}
                        >
                            <UpdateIcon />
                            {updatingAll ? 'Updating All…' : `Update All (${availableUpdates.length})`}
                        </button>
                    )}
                    <button
                        className={classNames(styles.refreshButton, checkingUpdates && styles.refreshButtonSpin)}
                        onClick={() => checkForUpdates()}
                        disabled={checkingUpdates}
                        aria-label="Check for updates"
                        title="Check for updates"
                    >
                        <RefreshIcon />
                    </button>
                </div>
            </header>

            <div className={styles.toolbar}>
                <div className={styles.searchBar}>
                    <input
                        value={searchTerm}
                        onChange={(event) => {
                            setSearchTerm(event.target.value);
                            setPage(1);
                        }}
                        className={styles.searchInput}
                        placeholder="Search installed liveries..."
                        type="search"
                    />
                    <button type="button" className={styles.iconButton} aria-label="Search">
                        <SearchIcon />
                    </button>
                </div>

                <div className={styles.toolbarControls}>
                    <select
                        className={styles.sortSelect}
                        value={sort}
                        onChange={(e) => {
                            setSort(e.target.value as SortKey);
                            setPage(1);
                        }}
                    >
                        <option value="date">Newest First</option>
                        <option value="name">Name A–Z</option>
                        <option value="developer">Developer</option>
                        <option value="aircraft">Aircraft</option>
                    </select>

                    {availableUpdates.length > 0 && (
                        <button
                            className={classNames(styles.chip, showUpdatesOnly && styles.chipActive)}
                            onClick={() => {
                                setShowUpdatesOnly(!showUpdatesOnly);
                                setPage(1);
                            }}
                        >
                            <UpdateIcon />
                            Updates Only
                        </button>
                    )}

                    {activeFilterCount > 0 && (
                        <button className={styles.clearAllLink} onClick={clearAllFilters}>
                            Clear all ({activeFilterCount})
                        </button>
                    )}
                </div>
            </div>

            {quickFilterGroups.length > 0 && (
                <div className={styles.quickFilterRail}>
                    {quickFilterGroups.map((group) => (
                        <div key={group.key} className={styles.quickFilterGroup}>
                            <div className={styles.quickFilterHeader}>
                                <span>{group.label}</span>
                                {filters[group.key] !== 'all' && (
                                    <button type="button" onClick={() => updateFilter(group.key, 'all')} className={styles.clearLink}>
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div className={styles.chipList}>
                                <button
                                    type="button"
                                    className={classNames(styles.chip, filters[group.key] === 'all' && styles.chipActive)}
                                    onClick={() => updateFilter(group.key, 'all')}
                                >
                                    All
                                </button>
                                {group.options.slice(0, group.limit ?? group.options.length).map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={classNames(styles.chip, filters[group.key] === option.value && styles.chipActive)}
                                        onClick={() => handleQuickSelect(group.key, option.value)}
                                    >
                                        <span>{option.label}</span>
                                        {option.hint && <small>{option.hint}</small>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className={styles.scrollContainer}>
                <div className={styles.paginationBar}>
                    <span className={styles.paginationText}>
                        {sorted.length > 0 ? (
                            <>Showing <strong>{startItem}–{endItem}</strong> of <strong>{sorted.length}</strong></>
                        ) : (
                            <>No results</>
                        )}
                    </span>
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

                {paginated.length ? (
                    <div className={styles.grid}>
                        {paginated.map((entry) => {
                            const liveryMatch = liveries.find((l) => l.name === entry.originalName);
                            const update = updatesMap.get(entry.liveryId);

                            return (
                                <DownloadedLiveryCard
                                    key={entry.installPath}
                                    entry={entry}
                                    liveryMatch={liveryMatch}
                                    update={update}
                                    onUninstall={handleUninstall}
                                    onUpdate={handleUpdate}
                                />
                            );
                        })}
                    </div>
                ) : (
                    <div className={styles.emptyState}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <p>{showUpdatesOnly ? 'No liveries with pending updates.' : 'No installed liveries match your filters.'}</p>
                    </div>
                )}
            </div>
        </section>
    );
};
