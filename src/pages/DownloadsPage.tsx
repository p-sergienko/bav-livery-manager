import { useMemo, useState } from 'react';
import { formatDate } from '@/utils/livery';
import { useLiveryStore } from '@/store/liveryStore';
import styles from './DownloadsPage.module.css';

const defaultFilters = {
    developer: 'all',
    aircraft: 'all',
    engine: 'all'
};

const classNames = (...tokens: Array<string | false>) => tokens.filter(Boolean).join(' ');

const SearchIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M11 3a8 8 0 0 1 8 8c0 1.848-.627 3.55-1.68 4.905l3.386 3.388a1 1 0 0 1-1.414 1.414l-3.388-3.386A7.96 7.96 0 0 1 11 19a8 8 0 1 1 0-16z" />
    </svg>
);

const FilterIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M4 21V14M4 10V3M12 21V12M12 8V3M20 21V16M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
);

const DOWNLOADS_PER_PAGE = 12;

export const DownloadsPage = () => {
    const installedLiveries = useLiveryStore((state) => state.installedLiveries);
    const liveries = useLiveryStore((state) => state.liveries);
    const uninstallEntry = useLiveryStore((state) => state.uninstallEntry);

    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState(defaultFilters);
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);

    const managedEntries = useMemo(
        () => installedLiveries.filter((entry) => entry.manifest?.livery_manager_metadata?.original_name),
        [installedLiveries]
    );

    const options = useMemo(() => {
        const developers = new Set<string>();
        const aircraft = new Set<string>();
        const engines = new Set<string>();

        managedEntries.forEach((entry) => {
            const metadata = entry.manifest?.livery_manager_metadata;
            const creator = entry.manifest?.creator;
            const aircraftTitle = entry.manifest?.title;
            const resolution = metadata?.resolution;

            if (creator) developers.add(creator);
            if (aircraftTitle) aircraft.add(aircraftTitle);
            if (resolution) engines.add(resolution);
        });

        return {
            developers: Array.from(developers),
            aircraft: Array.from(aircraft),
            engines: Array.from(engines)
        };
    }, [managedEntries]);

    const filtered = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return managedEntries.filter((entry) => {
            const metadata = entry.manifest?.livery_manager_metadata;
            const haystack = [
                entry.name,
                metadata?.original_name,
                metadata?.simulator,
                metadata?.resolution,
                entry.manifest?.creator,
                entry.manifest?.manufacturer
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            const matchesSearch = haystack.includes(term);
            const matchesDeveloper = filters.developer === 'all' || entry.manifest?.creator === filters.developer;
            const matchesAircraft = filters.aircraft === 'all' || entry.manifest?.title === filters.aircraft;
            const matchesResolution = filters.engine === 'all' || metadata?.resolution === filters.engine;

            return matchesSearch && matchesDeveloper && matchesAircraft && matchesResolution;
        });
    }, [managedEntries, searchTerm, filters]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / DOWNLOADS_PER_PAGE));
    const paginated = filtered.slice((page - 1) * DOWNLOADS_PER_PAGE, page * DOWNLOADS_PER_PAGE);

    const updateFilter = (key: keyof typeof filters, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const resetFilters = () => {
        setFilters({ ...defaultFilters });
        setPage(1);
    };

    return (
        <section className={styles.page}>
            <header className={styles.pageHeader}>
                <h1>My Downloads</h1>
            </header>

            <div className={styles.searchContainer}>
                <div className={styles.searchBar}>
                    <input
                        value={searchTerm}
                        onChange={(event) => {
                            setSearchTerm(event.target.value);
                            setPage(1);
                        }}
                        className={styles.searchInput}
                        placeholder="Search installed liveries..."
                    />
                    <button type="button" className={styles.iconButton} onClick={() => setPage(1)} aria-label="Search">
                        <SearchIcon />
                    </button>
                    <button
                        type="button"
                        className={classNames(styles.iconButton, showFilters && styles.iconButtonActive)}
                        onClick={() => setShowFilters((prev) => !prev)}
                        aria-label="Toggle filters"
                    >
                        <FilterIcon />
                    </button>
                </div>

                <div className={classNames(styles.filterPanel, showFilters && styles.filterPanelActive)}>
                    <div className={styles.filterRow}>
                        <select className={styles.filterSelect} value={filters.developer} onChange={(e) => updateFilter('developer', e.target.value)}>
                            <option value="all">All Developers</option>
                            {options.developers.map((developer) => (
                                <option key={developer} value={developer}>
                                    {developer}
                                </option>
                            ))}
                        </select>
                        <select className={styles.filterSelect} value={filters.aircraft} onChange={(e) => updateFilter('aircraft', e.target.value)}>
                            <option value="all">All Aircraft</option>
                            {options.aircraft.map((aircraftType) => (
                                <option key={aircraftType} value={aircraftType}>
                                    {aircraftType}
                                </option>
                            ))}
                        </select>
                        <select className={styles.filterSelect} value={filters.engine} onChange={(e) => updateFilter('engine', e.target.value)}>
                            <option value="all">All Resolutions</option>
                            {options.engines.map((engine) => (
                                <option key={engine} value={engine}>
                                    {engine}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button className={styles.resetButton} type="button" onClick={resetFilters}>
                        Reset filters
                    </button>
                </div>
            </div>

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
                            const metadata = entry.manifest?.livery_manager_metadata;
                            const manifest = entry.manifest;
                            const liveryMatch = liveries.find((l) => l.name === metadata?.original_name);
                            const preview = liveryMatch?.preview;
                            const aircraftTitle = manifest?.title ?? liveryMatch?.aircraftProfileName ?? 'Unknown aircraft';
                            const developer = manifest?.creator ?? liveryMatch?.developerName ?? 'Unknown developer';
                            const registration = liveryMatch?.registration ?? '—';
                            const simulatorLabel = (metadata?.simulator ?? entry.simulatorHint ?? 'Unknown').toUpperCase();

                            return (
                                <article key={entry.path} className={styles.card}>
                                    <div className={styles.cardMedia}>
                                        {preview ? (
                                            <img className={styles.cardImage} src={preview} alt={`${metadata?.original_name ?? entry.name} preview`} loading="lazy" />
                                        ) : (
                                            <div className={styles.cardPlaceholder}>No preview available</div>
                                        )}
                                        <span className={styles.cardBadge}>{simulatorLabel}</span>
                                    </div>

                                    <div className={styles.cardBody}>
                                        <header className={styles.cardHeader}>
                                            <div>
                                                <p className={styles.developer}>{developer}</p>
                                                <h3 className={styles.title}>{metadata?.original_name ?? entry.name}</h3>
                                            </div>
                                            {liveryMatch?.version && <span className={styles.badge}>v{liveryMatch.version}</span>}
                                        </header>

                                        <dl className={styles.meta}>
                                            <div>
                                                <dt className={styles.metaLabel}>Aircraft</dt>
                                                <dd className={styles.metaValue}>{aircraftTitle}</dd>
                                            </div>
                                            <div>
                                                <dt className={styles.metaLabel}>Resolution</dt>
                                                <dd className={styles.metaValue}>{metadata?.resolution ?? 'Unknown'}</dd>
                                            </div>
                                            <div>
                                                <dt className={styles.metaLabel}>Registration</dt>
                                                <dd className={styles.metaValue}>{registration}</dd>
                                            </div>
                                            <div>
                                                <dt className={styles.metaLabel}>Installed</dt>
                                                <dd className={styles.metaValue}>{formatDate(entry.installedDate)}</dd>
                                            </div>
                                        </dl>

                                        <div className={styles.actions}>
                                            <div className={styles.installPath} title={entry.path}>
                                                <span className={styles.metaLabel}>Folder</span>
                                                <span className={styles.pathValue}>{entry.name}</span>
                                            </div>
                                            <button className={styles.uninstallButton} onClick={() => uninstallEntry(entry)}>
                                                Uninstall
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <p className={styles.emptyState}>No manager-installed liveries match your filters.</p>
                )}
            </div>
        </section>
    );
};
