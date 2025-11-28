import { useEffect, useMemo, useState } from 'react';
import { LiveryCard } from '@/components/LiveryCard';
import { RangeSlider } from '@/components/RangeSlider';
import { ITEMS_PER_PAGE } from '@/utils/livery';
import type { Resolution, Simulator } from '@/types/livery';
import { useLiveryStore } from '@/store/liveryStore';
import { useAuthStore } from '@/store/authStore';
import type { CatalogResponse } from '@/types/catalog';
import { REMOTE_CATALOG_URL } from '@shared/constants';
import styles from './SearchPage.module.css';

type FilterKey = 'developer' | 'aircraft' | 'engine' | 'simulator' | 'resolution' | 'category';

const baseFilters: Record<FilterKey, string> = {
    developer: 'all',
    aircraft: 'all',
    engine: 'all',
    simulator: 'all',
    resolution: 'all',
    category: 'all'
};

const filterLabels: Record<FilterKey, string> = {
    developer: 'Developer',
    aircraft: 'Aircraft',
    engine: 'Engine',
    simulator: 'Simulator',
    resolution: 'Resolution',
    category: 'Category'
};

const createDefaultFilters = (): Record<FilterKey, string> => ({ ...baseFilters });

const uniqueStrings = (values: Array<string | null | undefined>) => {
    const set = new Set<string>();
    values.forEach((value) => {
        if (value && value.trim()) {
            set.add(value.trim());
        }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
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

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

const CATALOG_ENDPOINT = process.env.NODE_ENV === 'development' ? '/api/catalog' : REMOTE_CATALOG_URL;

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
    const installedLiveries = useLiveryStore((state) => state.installedLiveries);
    const authToken = useAuthStore((state) => state.token);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<Record<FilterKey, string>>(() => createDefaultFilters());
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE);
    const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogError, setCatalogError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'all' | 'installed'>('all');

    useEffect(() => {
        if (!authToken) {
            setCatalog(null);
            return;
        }

        let cancelled = false;
        const controller = new AbortController();

        const fetchCatalog = async () => {
            setCatalogLoading(true);
            setCatalogError(null);
            try {
                const response = await fetch(CATALOG_ENDPOINT, {
                    headers: { Authorization: `Bearer ${authToken}` },
                    signal: controller.signal
                });
                if (!response.ok) {
                    throw new Error(`Catalog request failed with status ${response.status}`);
                }
                const payload: CatalogResponse = await response.json();
                if (!cancelled) {
                    setCatalog(payload);
                }
            } catch (catalogErr) {
                if (cancelled || (catalogErr as Error)?.name === 'AbortError') {
                    return;
                }
                console.error('Failed to load catalog filters', catalogErr);
                setCatalog(null);
                setCatalogError('Catalog filters are temporarily unavailable.');
            } finally {
                if (!cancelled) {
                    setCatalogLoading(false);
                }
            }
        };

        fetchCatalog();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [authToken]);

    const fallbackOptions = useMemo(() => ({
        developers: uniqueStrings(liveries.map((l) => l.developer)),
        aircraft: uniqueStrings(liveries.map((l) => l.aircraftType)),
        engines: uniqueStrings(liveries.map((l) => l.engine)),
        simulators: uniqueStrings(liveries.map((l) => l.simulator)),
        resolutions: uniqueStrings(liveries.map((l) => (typeof l.resolution === 'string' ? l.resolution : null))),
        categories: uniqueStrings(liveries.map((l) => l.categoryName ?? undefined))
    }), [liveries]);

    const developerOptions = useMemo(() => {
        const names = catalog?.developers?.map((dev) => dev.name).filter(Boolean) ?? fallbackOptions.developers;
        return [...new Set(names)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }, [catalog?.developers, fallbackOptions.developers]);

    const aircraftOptions = useMemo(() => {
        const names = catalog?.aircraft?.map((air) => air.name).filter(Boolean) ?? fallbackOptions.aircraft;
        return [...new Set(names)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }, [catalog?.aircraft, fallbackOptions.aircraft]);

    const engineOptions = useMemo(() => fallbackOptions.engines, [fallbackOptions.engines]);

    const simulatorOptions = useMemo(() => {
        const codes = catalog?.simulators?.map((sim) => sim.code).filter(Boolean) ?? fallbackOptions.simulators;
        return [...new Set(codes)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }, [catalog?.simulators, fallbackOptions.simulators]);

    const resolutionOptions = useMemo(() => {
        const values = catalog?.resolutions?.map((res) => res.value).filter(Boolean) ?? fallbackOptions.resolutions;
        return [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }, [catalog?.resolutions, fallbackOptions.resolutions]);

    const categoryOptions = useMemo<ChipOption[]>(() => {
        if (catalog?.categories?.length) {
            return catalog.categories
                .filter((category) => Boolean(category.name))
                .map((category) => ({ value: category.name, label: category.name, hint: category.description ?? null }))
                .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
        }

        return fallbackOptions.categories.map((name) => ({ value: name, label: name }));
    }, [catalog?.categories, fallbackOptions.categories]);

    const valueMaps = useMemo(() => {
        const buildMap = (values: string[]) => {
            const map = new Map<string, string>();
            values.forEach((value) => map.set(value, value));
            return map;
        };

        return {
            developer: buildMap(developerOptions),
            aircraft: buildMap(aircraftOptions),
            engine: buildMap(engineOptions),
            simulator: buildMap(simulatorOptions),
            resolution: buildMap(resolutionOptions),
            category: new Map(categoryOptions.map((category) => [category.value, category.label]))
        } satisfies Record<FilterKey, Map<string, string>>;
    }, [developerOptions, aircraftOptions, engineOptions, simulatorOptions, resolutionOptions, categoryOptions]);

    const filterCounts = useMemo(() => {
        const makeCounts = (
            resolver: (livery: (typeof liveries)[number]) => string | null | undefined
        ): Map<string, number> => {
            const counts = new Map<string, number>();
            liveries.forEach((livery) => {
                const raw = resolver(livery)?.trim();
                if (!raw) {
                    return;
                }
                counts.set(raw, (counts.get(raw) ?? 0) + 1);
            });
            return counts;
        };

        return {
            developer: makeCounts((livery) => livery.developer),
            aircraft: makeCounts((livery) => livery.aircraftType ?? null),
            engine: makeCounts((livery) => livery.engine ?? null),
            simulator: makeCounts((livery) => livery.simulator ?? null),
            resolution: makeCounts((livery) => (typeof livery.resolution === 'string' ? livery.resolution : null)),
            category: makeCounts((livery) => livery.categoryName ?? null)
        } satisfies Record<FilterKey, Map<string, number>>;
    }, [liveries]);

    const quickFilterGroups = useMemo<QuickFilterGroup[]>(() => {
        const formatHint = (key: FilterKey, value: string) => {
            const count = filterCounts[key].get(value);
            return count ? `${numberFormatter.format(count)} available` : null;
        };

        const groups: QuickFilterGroup[] = [];

        if (simulatorOptions.length) {
            groups.push({
                key: 'simulator',
                label: 'Simulators',
                options: simulatorOptions.map((code) => ({
                    value: code,
                    label: code,
                    hint: formatHint('simulator', code)
                })),
                limit: 4
            });
        }

        if (resolutionOptions.length) {
            groups.push({
                key: 'resolution',
                label: 'Resolutions',
                options: resolutionOptions.map((value) => ({
                    value,
                    label: value,
                    hint: formatHint('resolution', value)
                })),
                limit: 4
            });
        }

        if (developerOptions.length) {
            groups.push({
                key: 'developer',
                label: 'Developers',
                options: developerOptions.map((name) => ({
                    value: name,
                    label: name,
                    hint: formatHint('developer', name)
                })),
                limit: 6
            });
        }

        if (categoryOptions.length) {
            groups.push({
                key: 'category',
                label: 'Categories',
                options: categoryOptions.map((category) => ({
                    value: category.value,
                    label: category.label,
                    hint: formatHint('category', category.value)
                })),
                limit: 8
            });
        }

        return groups;
    }, [categoryOptions, simulatorOptions, developerOptions, resolutionOptions, filterCounts]);

    const options = useMemo(() => ({
        developers: developerOptions,
        aircraft: aircraftOptions,
        engines: engineOptions,
        simulators: simulatorOptions,
        resolutions: resolutionOptions,
        categories: categoryOptions
    }), [developerOptions, aircraftOptions, engineOptions, simulatorOptions, resolutionOptions, categoryOptions]);

    const filteredLiveries = useMemo(() => {
        const term = searchTerm.toLowerCase();
        const matches = liveries.filter((livery) => {
            const matchesSearch =
                !term ||
                livery.name.toLowerCase().includes(term) ||
                livery.developer.toLowerCase().includes(term) ||
                (livery.aircraftType ?? '').toLowerCase().includes(term);

            const matchesDeveloper = filters.developer === 'all' || livery.developer === filters.developer;
            const matchesAircraft = filters.aircraft === 'all' || livery.aircraftType === filters.aircraft;
            const matchesEngine = filters.engine === 'all' || livery.engine === filters.engine;
            const matchesSimulator =
                filters.simulator === 'all' || (livery.simulator ?? '').toLowerCase() === filters.simulator.toLowerCase();
            const matchesResolution =
                filters.resolution === 'all' || (livery.resolution ?? '').toLowerCase() === filters.resolution.toLowerCase();
            const matchesCategory =
                filters.category === 'all' || (livery.categoryName ?? '').toLowerCase() === filters.category.toLowerCase();

            return (
                matchesSearch &&
                matchesDeveloper &&
                matchesAircraft &&
                matchesEngine &&
                matchesSimulator &&
                matchesResolution &&
                matchesCategory
            );
        });

        if (viewMode === 'installed') {
            return matches.filter((livery) =>
                isVariantInstalled(livery, settings.defaultResolution, settings.defaultSimulator)
            );
        }

        return matches;
    }, [
        filters,
        isVariantInstalled,
        liveries,
        searchTerm,
        settings.defaultResolution,
        settings.defaultSimulator,
        viewMode
    ]);

    const totalPages = Math.max(1, Math.ceil(filteredLiveries.length / itemsPerPage));
    const paginated = filteredLiveries.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    const updateFilter = (key: FilterKey, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const resetFilters = () => {
        setFilters(createDefaultFilters());
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

    const handleQuickSelect = (key: FilterKey, value: string) => {
        updateFilter(key, filters[key] === value ? 'all' : value);
    };

    const activeFilters = useMemo(() => {
        return (Object.keys(filters) as FilterKey[])
            .filter((key) => filters[key] !== 'all')
            .map((key) => ({
                key,
                label: filterLabels[key],
                value: valueMaps[key].get(filters[key]) ?? filters[key]
            }));
    }, [filters, valueMaps]);

    const insights = useMemo(
        () => [
            { label: 'Available', value: liveries.length, hint: 'Synced from panel' },
            { label: 'Matching', value: filteredLiveries.length, hint: viewMode === 'installed' ? 'Filtered & installed' : 'After filters' },
            { label: 'Installed', value: installedLiveries.length, hint: 'Detected locally' }
        ],
        [filteredLiveries.length, installedLiveries.length, liveries.length, viewMode]
    );

    return (
        <section className={styles.page}>
            <header className={styles.pageHeader}>
                <div className={styles.headerCopy}>
                    <span className={styles.headerEyebrow}>BAV catalog</span>
                    <h1>Liveries</h1>
                    {/* <p className={styles.headerSubtitle}>A focused view of the same data that powers the panel, tuned for quick installs.</p> */}
                </div>
                <div className={styles.viewToggle}>
                    <button
                        type="button"
                        className={classNames(styles.viewToggleButton, viewMode === 'all' && styles.viewToggleButtonActive)}
                        onClick={() => setViewMode('all')}
                    >
                        All liveries
                    </button>
                    <button
                        type="button"
                        className={classNames(styles.viewToggleButton, viewMode === 'installed' && styles.viewToggleButtonActive)}
                        onClick={() => setViewMode('installed')}
                    >
                        Installed only
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
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                handleSearchSubmit();
                            }
                        }}
                        placeholder="Search liveries by name, developer or aircraft"
                        className={styles.searchInput}
                        type="search"
                    />
                    <button type="button" className={styles.iconButton} aria-label="Search" onClick={handleSearchSubmit}>
                        <SearchIcon />
                    </button>
                </div>
            </div>
            {catalogLoading && <p className={styles.catalogStatus}>Refreshing catalog metadata…</p>}
            {catalogError && <p className={classNames(styles.catalogStatus, styles.catalogStatusError)}>{catalogError}</p>}

            {quickFilterGroups.length ? (
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
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className={styles.quickFilterPlaceholder}>Catalog metadata syncs here for instant pivots.</div>
            )}

            <div className={classNames(styles.advancedPanel, showFilters && styles.advancedPanelVisible)}>
                <div className={styles.advancedGrid}>
                    <label className={styles.advancedField}>
                        <span className={styles.advancedLabel}>Developer</span>
                        <select className={styles.filterSelect} value={filters.developer} onChange={(e) => updateFilter('developer', e.target.value)}>
                            <option value="all">All</option>
                            {options.developers.map((developer) => {
                                const count = filterCounts.developer.get(developer);
                                return (
                                    <option key={developer} value={developer}>
                                        {count ? `${developer} (${numberFormatter.format(count)})` : developer}
                                    </option>
                                );
                            })}
                        </select>
                    </label>
                    <label className={styles.advancedField}>
                        <span className={styles.advancedLabel}>Aircraft</span>
                        <select className={styles.filterSelect} value={filters.aircraft} onChange={(e) => updateFilter('aircraft', e.target.value)}>
                            <option value="all">All</option>
                            {options.aircraft.map((aircraftType) => {
                                const count = filterCounts.aircraft.get(aircraftType);
                                return (
                                    <option key={aircraftType} value={aircraftType}>
                                        {count ? `${aircraftType} (${numberFormatter.format(count)})` : aircraftType}
                                    </option>
                                );
                            })}
                        </select>
                    </label>
                    <label className={styles.advancedField}>
                        <span className={styles.advancedLabel}>Engine</span>
                        <select className={styles.filterSelect} value={filters.engine} onChange={(e) => updateFilter('engine', e.target.value)}>
                            <option value="all">All</option>
                            {options.engines.map((engine) => {
                                const count = filterCounts.engine.get(engine);
                                return (
                                    <option key={engine} value={engine}>
                                        {count ? `${engine} (${numberFormatter.format(count)})` : engine}
                                    </option>
                                );
                            })}
                        </select>
                    </label>
                    <label className={styles.advancedField}>
                        <span className={styles.advancedLabel}>Simulator</span>
                        <select className={styles.filterSelect} value={filters.simulator} onChange={(e) => updateFilter('simulator', e.target.value)}>
                            <option value="all">All</option>
                            {options.simulators.map((simulator) => {
                                const count = filterCounts.simulator.get(simulator);
                                return (
                                    <option key={simulator} value={simulator}>
                                        {count ? `${simulator} (${numberFormatter.format(count)})` : simulator}
                                    </option>
                                );
                            })}
                        </select>
                    </label>
                    <label className={styles.advancedField}>
                        <span className={styles.advancedLabel}>Resolution</span>
                        <select className={styles.filterSelect} value={filters.resolution} onChange={(e) => updateFilter('resolution', e.target.value)}>
                            <option value="all">All</option>
                            {options.resolutions.map((resolution) => {
                                const count = filterCounts.resolution.get(resolution);
                                return (
                                    <option key={resolution} value={resolution}>
                                        {count ? `${resolution}` : resolution}
                                    </option>
                                );
                            })}
                        </select>
                    </label>
                    <label className={styles.advancedField}>
                        <span className={styles.advancedLabel}>Category</span>
                        <select className={styles.filterSelect} value={filters.category} onChange={(e) => updateFilter('category', e.target.value)}>
                            <option value="all">All</option>
                            {options.categories.map((category) => {
                                const count = filterCounts.category.get(category.value);
                                const label = count
                                    ? `${category.label} (${numberFormatter.format(count)})`
                                    : category.label;
                                return (
                                    <option key={category.value} value={category.value}>
                                        {label}
                                    </option>
                                );
                            })}
                        </select>
                    </label>
                </div>
                <div className={styles.advancedFooter}>
                    <div className={styles.sliderStack}>
                        <RangeSlider label="Results per page" min={6} max={30} step={3} value={itemsPerPage} onChange={handleSliderChange} />
                        <span className={styles.sliderValue}>{itemsPerPage} per grid</span>
                    </div>
                    <button className={styles.resetButton} type="button" onClick={resetFilters}>
                        Reset filters
                    </button>
                </div>
            </div>

            {activeFilters.length > 0 && (
                <div className={styles.activeFilters}>
                    {activeFilters.map((filter) => (
                        <button key={filter.key} type="button" className={styles.filterBadge} onClick={() => updateFilter(filter.key, 'all')}>
                            <span>
                                {filter.label}: <strong>{filter.value}</strong>
                            </span>
                            <span aria-hidden>×</span>
                        </button>
                    ))}
                    <button type="button" className={classNames(styles.filterBadge, styles.filterBadgeClear)} onClick={resetFilters}>
                        Clear all
                    </button>
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

                {loading ? (
                    <p className={styles.loading}>Loading liveries…</p>
                ) : paginated.length ? (
                    <div className={styles.grid}>
                        {paginated.map((livery) => (
                            <LiveryCard
                                key={livery.id}
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
