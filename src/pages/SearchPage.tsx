import { useMemo, useState } from 'react';
import { LiveryCard } from '@/components/LiveryCard';
import { RangeSlider } from '@/components/RangeSlider';
import { ITEMS_PER_PAGE } from '@/utils/livery';
import type { Resolution, Simulator } from '@/types/livery';
import { useLiveryStore } from '@/store/liveryStore';
import styles from './SearchPage.module.css';

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

export const SearchPage = () => {
    const liveries = useLiveryStore((state) => state.liveries);
    const loading = useLiveryStore((state) => state.loading);
    const error = useLiveryStore((state) => state.error);
    const settings = useLiveryStore((state) => state.settings);
    const downloadStates = useLiveryStore((state) => state.downloadStates);
    const handleDownload = useLiveryStore((state) => state.handleDownload);
    const handleUninstall = useLiveryStore((state) => state.handleUninstall);
    const isVariantInstalled = useLiveryStore((state) => state.isVariantInstalled);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState(defaultFilters);
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE);

    const options = useMemo(() => {
        const developers = Array.from(new Set(liveries.map((l) => l.developer))).filter(Boolean);
        const aircraft = Array.from(new Set(liveries.map((l) => l.aircraftType))).filter(Boolean);
        const engines = Array.from(new Set(liveries.map((l) => l.engine))).filter(Boolean);
        return {
            developers,
            aircraft,
            engines
        };
    }, [liveries]);

    const filteredLiveries = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return liveries.filter((livery) => {
            const matchesSearch =
                !term ||
                livery.name.toLowerCase().includes(term) ||
                livery.developer.toLowerCase().includes(term) ||
                (livery.aircraftType ?? '').toLowerCase().includes(term);

            const matchesDeveloper = filters.developer === 'all' || livery.developer === filters.developer;
            const matchesAircraft = filters.aircraft === 'all' || livery.aircraftType === filters.aircraft;
            const matchesEngine = filters.engine === 'all' || livery.engine === filters.engine;

            return matchesSearch && matchesDeveloper && matchesAircraft && matchesEngine;
        });
    }, [filters.aircraft, filters.developer, filters.engine, liveries, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filteredLiveries.length / itemsPerPage));
    const paginated = filteredLiveries.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    const updateFilter = (key: keyof typeof filters, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const resetFilters = () => {
        setFilters({ ...defaultFilters });
        setItemsPerPage(ITEMS_PER_PAGE);
        setPage(1);
    };

    const handleSliderChange = (value: number) => {
        setItemsPerPage(value);
        setPage(1);
    };

    const handleSearchSubmit = () => {
        setPage(1);
    };

    return (
        <section className={styles.page}>
            <header className={styles.pageHeader}>
                <h1>Search</h1>
            </header>

            <div className={styles.searchContainer}>
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
                        placeholder="Search liveries..."
                        className={styles.searchInput}
                        type="search"
                    />
                    <button type="button" className={styles.iconButton} aria-label="Search" onClick={handleSearchSubmit}>
                        <SearchIcon />
                    </button>
                    <button
                        type="button"
                        className={classNames(styles.iconButton, showFilters && styles.iconButtonActive)}
                        aria-label="Toggle filters"
                        onClick={() => setShowFilters((prev) => !prev)}
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
                            <option value="all">All Engines</option>
                            {options.engines.map((engine) => (
                                <option key={engine} value={engine}>
                                    {engine}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className={styles.sliderRow}>
                        <RangeSlider label="Results per page" min={6} max={30} step={3} value={itemsPerPage} onChange={handleSliderChange} />
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

                {loading ? (
                    <p className={styles.loading}>Loading liveries…</p>
                ) : paginated.length ? (
                    <div className={styles.grid}>
                        {paginated.map((livery) => (
                            <LiveryCard
                                key={livery.name}
                                livery={livery}
                                defaultResolution={settings.defaultResolution}
                                defaultSimulator={settings.defaultSimulator}
                                downloadState={downloadStates[livery.name]}
                                isInstalled={(resolution, simulator) => isVariantInstalled(livery, resolution, simulator)}
                                onDownload={(resolution: Resolution, simulator: Simulator) => handleDownload(livery, resolution, simulator)}
                                onUninstall={(resolution: Resolution, simulator: Simulator) => handleUninstall(livery, resolution, simulator)}
                            />
                        ))}
                    </div>
                ) : (
                    <p className={styles.emptyState}>No liveries match your filters.</p>
                )}
            </div>

            {error && <div className={styles.statusMessage}>{error}</div>}
        </section>
    );
};
