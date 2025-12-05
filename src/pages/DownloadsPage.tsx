import { useMemo, useState } from 'react';
import { DownloadedLiveryCard } from '@/components/DownloadedLiveryCard';
import { useLiveryStore } from '@/store/liveryStore';
import styles from './DownloadsPage.module.css';

type FilterKey = 'developer' | 'aircraft' | 'resolution' | 'simulator';

const baseFilters: Record<FilterKey, string> = {
    developer: 'all',
    aircraft: 'all',
    resolution: 'all',
    simulator: 'all'
};

const filterLabels: Record<FilterKey, string> = {
    developer: 'Developer',
    aircraft: 'Aircraft',
    resolution: 'Resolution',
    simulator: 'Simulator'
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

const classNames = (...tokens: Array<string | false>) => tokens.filter(Boolean).join(' ');

const SearchIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M11 3a8 8 0 0 1 8 8c0 1.848-.627 3.55-1.68 4.905l3.386 3.388a1 1 0 0 1-1.414 1.414l-3.388-3.386A7.96 7.96 0 0 1 11 19a8 8 0 1 1 0-16z" />
    </svg>
);

const DOWNLOADS_PER_PAGE = 12;

export const DownloadsPage = () => {
    const installedLiveries = useLiveryStore((state) => state.installedLiveries);
    const liveries = useLiveryStore((state) => state.liveries);
    const uninstallEntry = useLiveryStore((state) => state.uninstallEntry);

    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState(baseFilters);
    const [page, setPage] = useState(1);

    const managedEntries = useMemo(
        () => installedLiveries.filter((entry) => entry.originalName),
        [installedLiveries]
    );

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
                    .map(([value, count]) => ({ value, label: value, hint: `${count} installed` }))
                    .sort((a, b) => a.label.localeCompare(b.label))
            });
        }

        if (aircraft.size) {
            groups.push({
                key: 'aircraft',
                label: 'Aircraft',
                options: Array.from(aircraft.entries())
                    .map(([value, count]) => ({ value, label: value, hint: `${count} installed` }))
                    .sort((a, b) => a.label.localeCompare(b.label)),
                limit: 6
            });
        }

        if (resolutions.size) {
            groups.push({
                key: 'resolution',
                label: 'Resolutions',
                options: Array.from(resolutions.entries())
                    .map(([value, count]) => ({ value, label: value, hint: `${count} installed` }))
                    .sort((a, b) => a.label.localeCompare(b.label))
            });
        }

        if (developers.size) {
            groups.push({
                key: 'developer',
                label: 'Developers',
                options: Array.from(developers.entries())
                    .map(([value, count]) => ({ value, label: value, hint: `${count} installed` }))
                    .sort((a, b) => a.label.localeCompare(b.label)),
                limit: 6
            });
        }

        return groups;
    }, [managedEntries, liveries]);

    const filtered = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return managedEntries.filter((entry) => {
            // Match against catalog for extra info
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

            return matchesSearch && matchesDeveloper && matchesAircraft && matchesResolution && matchesSimulator;
        });
    }, [managedEntries, liveries, searchTerm, filters]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / DOWNLOADS_PER_PAGE));
    const paginated = filtered.slice((page - 1) * DOWNLOADS_PER_PAGE, page * DOWNLOADS_PER_PAGE);

    const updateFilter = (key: FilterKey, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const handleQuickSelect = (key: FilterKey, value: string) => {
        updateFilter(key, filters[key] === value ? 'all' : value);
    };

    const handleSearchSubmit = () => {
        setPage(1);
    };

    return (
        <section className={styles.page}>
            <header className={styles.pageHeader}>
                <div className={styles.headerCopy}>
                    <h1>My Downloads</h1>
                    <p className={styles.headerSubtitle}>
                        {filtered.length} {filtered.length === 1 ? 'livery' : 'liveries'} installed
                    </p>
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
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                handleSearchSubmit();
                            }
                        }}
                        className={styles.searchInput}
                        placeholder="Search installed liveries..."
                        type="search"
                    />
                    <button type="button" className={styles.iconButton} onClick={handleSearchSubmit} aria-label="Search">
                        <SearchIcon />
                    </button>
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
                        Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                    </span>
                    <div className={styles.paginationButtons}>
                        <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                                <path d="M15 18l-6-6 6-6" />
                            </svg>
                        </button>
                        <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                                <path d="M9 18l6-6-6-6" />
                            </svg>
                        </button>
                    </div>
                </div>

                {paginated.length ? (
                    <div className={styles.grid}>
                        {paginated.map((entry) => {
                            const liveryMatch = liveries.find((l) => l.name === entry.originalName);

                            return (
                                <DownloadedLiveryCard
                                    key={entry.installPath}
                                    entry={entry}
                                    liveryMatch={liveryMatch}
                                    onUninstall={uninstallEntry}
                                />
                            );
                        })}
                    </div>
                ) : (
                    <p className={styles.emptyState}>No installed liveries match your filters.</p>
                )}
            </div>
        </section>
    );
};
