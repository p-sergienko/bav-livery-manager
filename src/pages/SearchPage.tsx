import { useCallback, useEffect, useMemo, useState } from 'react';
import { LiveryCard } from '@/components/LiveryCard';
import { RangeSlider } from '@/components/RangeSlider';
import { ITEMS_PER_PAGE } from '@/utils/livery';
import type { Livery, Resolution, Simulator } from '@/types/livery';
import { useLiveryStore } from '@/store/liveryStore';
import { useAuthStore } from '@/store/authStore';
import { useCatalogQuery } from '@/hooks/useCatalogQuery';
import { useLiveriesQuery } from '@/hooks/useLiveriesQuery';
import { Toast } from '@/components/Toast';
import styles from './SearchPage.module.css';

type FilterKey = 'developer' | 'aircraft' | 'engine' | 'simulator' | 'resolution' | 'category';

const baseFilters: Record<FilterKey, string> = {
    developer: 'all',
    aircraft: 'all',
    engine: 'all',
    simulator: '',
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

const createDefaultFilters = (simulator: string): FilterState => ({ ...baseFilters, simulator });

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

type FilterState = Record<FilterKey, string>;
type FilterCounts = Record<FilterKey, Map<string, number>>;
type ValueMaps = Record<FilterKey, Map<string, string>>;

const UNCATEGORIZED = '__uncategorized';

const dedupeOptions = (entries: ChipOption[]) => {
    const map = new Map<string, ChipOption>();
    entries.forEach(({ value, label, hint }) => {
        if (!value) {
            return;
        }
        if (!map.has(value)) {
            map.set(value, { value, label, hint: hint ?? null });
        }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
};

const buildFallbackOptions = (liveries: Livery[]) => {
    const categories = dedupeOptions(
        liveries.map((l) => ({
            value: l.categoryId ?? l.categoryName ?? '',
            label: l.categoryName ?? l.categoryId ?? ''
        }))
    );

    const hasUncategorized = liveries.some((l) => !(l.categoryId || l.categoryName));
    if (hasUncategorized) {
        categories.push({ value: UNCATEGORIZED, label: 'Uncategorized' });
    }

    return {
        developers: dedupeOptions(liveries.map((l) => ({ value: l.developerId, label: l.developerName }))),
        aircraft: dedupeOptions(liveries.map((l) => ({ value: l.aircraftProfileId, label: l.aircraftProfileName }))),
        engines: uniqueStrings(liveries.map((l) => l.engine)),
        simulators: dedupeOptions(liveries.map((l) => ({ value: l.simulatorId, label: l.simulatorCode || l.simulatorId }))),
        resolutions: dedupeOptions(liveries.map((l) => ({ value: l.resolutionId, label: l.resolutionValue }))),
        categories
    };
};

const buildValueMaps = (options: {
    developers: ChipOption[];
    aircraft: ChipOption[];
    engines: string[];
    simulators: ChipOption[];
    resolutions: ChipOption[];
    categories: ChipOption[];
}): ValueMaps => {
    const buildMapFromOptions = (opts: ChipOption[]) => {
        const map = new Map<string, string>();
        opts.forEach((option) => map.set(option.value, option.label));
        return map;
    };
    const buildMapFromStrings = (values: string[]) => {
        const map = new Map<string, string>();
        values.forEach((value) => {
            if (value) {
                map.set(value, value);
            }
        });
        return map;
    };

    return {
        developer: buildMapFromOptions(options.developers),
        aircraft: buildMapFromOptions(options.aircraft),
        engine: buildMapFromStrings(options.engines),
        simulator: buildMapFromOptions(options.simulators),
        resolution: buildMapFromOptions(options.resolutions),
        category: new Map(options.categories.map((category) => [category.value, category.label]))
    } satisfies ValueMaps;
};

const buildFilterCounts = (liveries: Livery[]): FilterCounts => {
    const makeCounts = (resolver: (livery: Livery) => string | null | undefined) => {
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
        developer: makeCounts((livery) => livery.developerId),
        aircraft: makeCounts((livery) => livery.aircraftProfileId ?? null),
        engine: makeCounts((livery) => livery.engine ?? null),
        simulator: makeCounts((livery) => livery.simulatorId ?? null),
        resolution: makeCounts((livery) => livery.resolutionId ?? null),
        category: makeCounts((livery) => livery.categoryId ?? livery.categoryName ?? UNCATEGORIZED)
    } satisfies FilterCounts;
};

const dedupeLiveriesForDisplay = (liveries: Livery[], preferredResolution: Resolution): Livery[] => {
    const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
    const map = new Map<string, Livery>();

    liveries.forEach((entry) => {
        const key = [normalize(entry.simulatorId), normalize(entry.developerId), normalize(entry.aircraftProfileId), normalize(entry.title ?? entry.name)].join('|');

        const score = (candidate: Livery) => {
            const resScore = normalize(candidate.resolutionValue) === normalize(preferredResolution) ? 2 : 0;
            const previewScore = candidate.preview ? 1 : 0;
            return resScore + previewScore;
        };

        const existing = map.get(key);
        if (!existing) {
            map.set(key, entry);
            return;
        }

        if (score(entry) > score(existing)) {
            map.set(key, entry);
        }
    });

    return Array.from(map.values());
};

const filterLiveries = (
    liveries: Livery[],
    filters: FilterState,
    searchTerm: string,
    viewMode: 'all' | 'installed',
    settings: { defaultResolution: Resolution; defaultSimulator: Simulator },
    isVariantInstalled: (livery: Livery, resolution: Resolution, simulator: Simulator) => boolean
) => {
    const term = searchTerm.toLowerCase();
    const matches = liveries.filter((livery) => {
        const matchesSearch =
            !term ||
            livery.name.toLowerCase().includes(term) ||
            livery.developerName.toLowerCase().includes(term) ||
            (livery.aircraftProfileName ?? '').toLowerCase().includes(term) ||
            livery.simulatorCode.toLowerCase().includes(term) ||
            livery.resolutionValue.toLowerCase().includes(term);

        const matchesDeveloper = filters.developer === 'all' || livery.developerId === filters.developer;
        const matchesAircraft = filters.aircraft === 'all' || livery.aircraftProfileId === filters.aircraft;
        const matchesEngine = filters.engine === 'all' || livery.engine === filters.engine;
        const matchesSimulator = filters.simulator ? livery.simulatorId === filters.simulator : false;
        const matchesResolution = filters.resolution === 'all' || livery.resolutionId === filters.resolution;
        const matchesCategory = (() => {
            if (filters.category === 'all') return true;
            const value = filters.category.trim();
            if (!value) return true;
            if (value === UNCATEGORIZED) {
                return !livery.categoryId && !livery.categoryName;
            }
            const lower = value.toLowerCase();
            return livery.categoryId === value || (livery.categoryName ?? '').toLowerCase() === lower;
        })();

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
        return matches.filter((livery) => isVariantInstalled(livery, settings.defaultResolution, settings.defaultSimulator));
    }

    return matches;
};

interface QuickFilterGroup {
    key: FilterKey;
    label: string;
    options: ChipOption[];
    limit?: number;
}

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

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
    const clearError = useLiveryStore((state) => state.clearError);
    const settings = useLiveryStore((state) => state.settings);
    const downloadStates = useLiveryStore((state) => state.downloadStates);
    const handleDownload = useLiveryStore((state) => state.handleDownload);
    const handleUninstall = useLiveryStore((state) => state.handleUninstall);
    const isVariantInstalled = useLiveryStore((state) => state.isVariantInstalled);
    const installedLiveries = useLiveryStore((state) => state.installedLiveries);
    const authToken = useAuthStore((state) => state.token);
    const authError = useAuthStore((state) => state.error);
    const clearAuthError = useAuthStore((state) => state.setError);
    const [searchTerm, setSearchTerm] = useState('');
    const pathEnabledSimulators = useMemo<Simulator[]>(() => {
        const sims: Simulator[] = [];
        if (settings.msfs2020Path) sims.push('FS20');
        if (settings.msfs2024Path) sims.push('FS24');
        return sims;
    }, [settings.msfs2020Path, settings.msfs2024Path]);

    const [filters, setFilters] = useState<FilterState>(() => createDefaultFilters(''));
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE);
    const [viewMode, setViewMode] = useState<'all' | 'installed'>('all');
    const { data: catalog, isFetching: catalogLoading } = useCatalogQuery(authToken);
    const { isFetching: liveriesFetching } = useLiveriesQuery();

    const fallbackOptions = useMemo(() => buildFallbackOptions(liveries), [liveries]);


    const developerOptions = useMemo<ChipOption[]>(() => {
        if (catalog?.developers?.length) {
            const entries = catalog.developers
                .filter((dev) => dev.id && dev.name)
                .map((dev) => ({ value: dev.id, label: dev.name }));
            return dedupeOptions(entries);
        }
        return fallbackOptions.developers;
    }, [catalog?.developers, fallbackOptions.developers]);

    const aircraftOptions = useMemo<ChipOption[]>(() => {
        if (catalog?.aircraft?.length) {
            const entries = catalog.aircraft
                .filter((air) => air.id && air.name)
                .map((air) => ({ value: air.id, label: air.name }));
            return dedupeOptions(entries);
        }
        return fallbackOptions.aircraft;
    }, [catalog?.aircraft, fallbackOptions.aircraft]);

    const engineOptions = useMemo(() => fallbackOptions.engines, [fallbackOptions.engines]);

    const simulatorOptions = useMemo<ChipOption[]>(() => {
        const catalogOptions = (catalog?.simulators ?? [])
            .filter((sim) => sim.id && sim.code)
            .map((sim) => ({ value: sim.id, label: sim.code }));

        return dedupeOptions([...catalogOptions, ...fallbackOptions.simulators]);
    }, [catalog?.simulators, fallbackOptions.simulators]);
    const resolveSimulatorValue = useCallback(
        (code: Simulator): string | null => {
            const match = simulatorOptions.find((opt) => opt.label.toUpperCase() === code);
            return match?.value ?? null;
        },
        [simulatorOptions]
    );

    const allowedSimulatorValues = useMemo(
        () =>
            pathEnabledSimulators
                .map((code) => resolveSimulatorValue(code))
                .filter((value): value is string => Boolean(value)),
        [pathEnabledSimulators, resolveSimulatorValue]
    );

    const resolutionOptions = useMemo<ChipOption[]>(() => {
        if (catalog?.resolutions?.length) {
            const entries = catalog.resolutions
                .filter((res) => res.id && res.value)
                .map((res) => ({ value: res.id, label: res.value }));
            return dedupeOptions(entries);
        }
        return fallbackOptions.resolutions;
    }, [catalog?.resolutions, fallbackOptions.resolutions]);

    const categoryOptions = useMemo<ChipOption[]>(() => {
        const fromCatalog = (catalog?.categories ?? [])
            .filter((category) => Boolean(category.name || category.id))
            .map((category) => ({
                value: category.id ?? category.name,
                label: category.name ?? category.id ?? 'Unlabeled',
                hint: category.description ?? null
            }));

        const combined = dedupeOptions([...fromCatalog, ...fallbackOptions.categories]);

        const needsUncategorized = liveries.some((l) => !(l.categoryId || l.categoryName));
        if (needsUncategorized && !combined.find((c) => c.value === UNCATEGORIZED)) {
            combined.push({ value: UNCATEGORIZED, label: 'Uncategorized' });
        }

        return combined;
    }, [catalog?.categories, fallbackOptions.categories, liveries]);

    const hasSimulatorPathConfigured = pathEnabledSimulators.length > 0;
    const hasSimulatorSelection = allowedSimulatorValues.length > 0;
    const activeSimulatorLabel = simulatorOptions.find((opt) => opt.value === filters.simulator)?.label ?? null;
    const activeSimulatorCode: Simulator | null = (() => {
        if (!activeSimulatorLabel) return null;
        const normalized = activeSimulatorLabel.toUpperCase();
        return normalized === 'FS24' ? 'FS24' : normalized === 'FS20' ? 'FS20' : null;
    })();

    const simulatorLogoMap: Record<Simulator, string> = {
        FS20: 'https://upload.wikimedia.org/wikipedia/commons/e/ed/Microsoft_Flight_Simulator_%282020%29_logo.png',
        FS24: 'https://flightsimulator.azureedge.net/wp-content/uploads/2024/09/website-logo-with-MSFS-1-1024x282.png'
    };
    const simulatorLogoKey: Simulator = activeSimulatorCode ?? settings.defaultSimulator;

    const valueMaps = useMemo<ValueMaps>(() => buildValueMaps({
        developers: developerOptions,
        aircraft: aircraftOptions,
        engines: engineOptions,
        simulators: simulatorOptions,
        resolutions: resolutionOptions,
        categories: categoryOptions
    }), [developerOptions, aircraftOptions, engineOptions, simulatorOptions, resolutionOptions, categoryOptions]);

    useEffect(() => {
        if (!simulatorOptions.length) return;

        if (!allowedSimulatorValues.length) {
            if (filters.simulator !== '') {
                setFilters((prev) => ({ ...prev, simulator: '' }));
            }
            return;
        }

        const currentValid = allowedSimulatorValues.includes(filters.simulator);
        const preferredBySettings = resolveSimulatorValue(settings.defaultSimulator);
        const next = currentValid
            ? filters.simulator
            : (preferredBySettings && allowedSimulatorValues.includes(preferredBySettings))
                ? preferredBySettings
                : allowedSimulatorValues[0];

        if (next !== filters.simulator) {
            setFilters((prev) => ({ ...prev, simulator: next }));
        }
    }, [allowedSimulatorValues, filters.simulator, resolveSimulatorValue, settings.defaultSimulator, simulatorOptions]);

    const filterCounts = useMemo<FilterCounts>(() => buildFilterCounts(liveries), [liveries]);

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
                options: simulatorOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                    hint: formatHint('simulator', option.value)
                })),
                limit: 4
            });
        }

        if (resolutionOptions.length) {
            groups.push({
                key: 'resolution',
                label: 'Resolutions',
                options: resolutionOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                    hint: formatHint('resolution', option.value)
                })),
                limit: 4
            });
        }

        return groups;
    }, [simulatorOptions, resolutionOptions, filterCounts]);

    const quickSelectConfigs = useMemo(
        () => [
            { key: 'developer' as const, label: 'Developers', options: developerOptions, counts: filterCounts.developer },
            { key: 'aircraft' as const, label: 'Aircraft', options: aircraftOptions, counts: filterCounts.aircraft },
            { key: 'category' as const, label: 'Categories', options: categoryOptions, counts: filterCounts.category }
        ],
        [aircraftOptions, categoryOptions, developerOptions, filterCounts]
    );

    const options = useMemo(() => ({
        developers: developerOptions,
        aircraft: aircraftOptions,
        engines: engineOptions,
        simulators: simulatorOptions,
        resolutions: resolutionOptions,
        categories: categoryOptions
    }), [developerOptions, aircraftOptions, engineOptions, simulatorOptions, resolutionOptions, categoryOptions]);

    const filteredLiveries = useMemo(
        () =>
            hasSimulatorSelection
                ? filterLiveries(
                    liveries,
                    filters,
                    searchTerm,
                    viewMode,
                    { defaultResolution: settings.defaultResolution, defaultSimulator: settings.defaultSimulator },
                    isVariantInstalled
                )
                : [],
        [filters, hasSimulatorSelection, isVariantInstalled, liveries, searchTerm, settings.defaultResolution, settings.defaultSimulator, viewMode]
    );

    const dedupedLiveries = useMemo(
        () => dedupeLiveriesForDisplay(filteredLiveries, settings.defaultResolution),
        [filteredLiveries, settings.defaultResolution]
    );

    const totalPages = Math.max(1, Math.ceil(dedupedLiveries.length / itemsPerPage));
    const paginated = dedupedLiveries.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    const updateFilter = (key: FilterKey, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const resetFilters = () => {
        const defaultSimulatorValue = allowedSimulatorValues[0] ?? filters.simulator;
        setFilters(createDefaultFilters(defaultSimulatorValue));
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
        if (key === 'simulator') {
            updateFilter(key, value);
            return;
        }
        updateFilter(key, filters[key] === value ? 'all' : value);
    };

    const activeFilters = useMemo(() => {
        return (Object.keys(filters) as FilterKey[])
            .filter((key) => filters[key] !== 'all' && filters[key] !== '')
            .map((key) => ({
                key,
                label: filterLabels[key],
                value: valueMaps[key].get(filters[key]) ?? filters[key]
            }));
    }, [filters, valueMaps]);

    const insights = useMemo(
        () => [
            { label: 'Available', value: liveries.length, hint: 'Synced from panel' },
            { label: 'Matching', value: dedupedLiveries.length, hint: viewMode === 'installed' ? 'Filtered & installed' : 'After filters' },
            { label: 'Installed', value: installedLiveries.length, hint: 'Detected locally' }
        ],
        [dedupedLiveries.length, installedLiveries.length, liveries.length, viewMode]
    );

    return (
        <section className={styles.page}>
            <header className={styles.pageHeader}>
                <div className={styles.headerCopy}>
                    <h1 className={styles.title}>Liveries </h1>
                    {simulatorLogoKey && (
                        <div className={styles.simulatorLogoWrap} aria-hidden>
                            <img
                                src={simulatorLogoMap[simulatorLogoKey] ?? ''}
                                alt={simulatorLogoKey === 'FS24' ? 'Microsoft Flight Simulator 2024' : 'Microsoft Flight Simulator 2020'}
                                className={styles.simulatorLogo}
                            />
                        </div>
                    )}
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

            {(authError || error) && (
                <Toast
                    type="error"
                    message={authError || error || ''}
                    onClose={() => {
                        if (authError) clearAuthError(null);
                        if (error) clearError();
                    }}
                />
            )}

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
            {!hasSimulatorPathConfigured && (
                <p className={classNames(styles.catalogStatus, styles.catalogStatusError)}>
                    Configure a simulator path in Settings to browse and install liveries.
                </p>
            )}

            <div className={styles.quickFilterRail}>
                {quickFilterGroups.length ? (
                    quickFilterGroups.map((group) => (
                        <div key={group.key} className={styles.quickFilterGroup}>
                            <div className={styles.quickFilterHeader}>
                                <span>{group.label}</span>
                                {group.key !== 'simulator' && filters[group.key] !== 'all' && (
                                    <button type="button" onClick={() => updateFilter(group.key, 'all')} className={styles.clearLink}>
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div className={styles.chipList}>
                                {group.key !== 'simulator' && (
                                    <button
                                        type="button"
                                        className={classNames(styles.chip, filters[group.key] === 'all' && styles.chipActive)}
                                        onClick={() => updateFilter(group.key, 'all')}
                                    >
                                        All
                                    </button>
                                )}
                                {group.options.slice(0, group.limit ?? group.options.length).map((option) => {
                                    const disabled = group.key === 'simulator' && !pathEnabledSimulators.includes(option.label.toUpperCase() as Simulator);
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            className={classNames(styles.chip, filters[group.key] === option.value && styles.chipActive)}
                                            disabled={disabled}
                                            onClick={() => !disabled && handleQuickSelect(group.key, option.value)}
                                        >
                                            <span>{option.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className={styles.quickFilterPlaceholder}>Catalog metadata syncs here for instant pivots.</div>
                )}

                <div className={styles.quickSelectCluster}>
                    {quickSelectConfigs.map(({ key, label, options: optionList, counts }) => (
                        <div key={key} className={styles.quickSelectGroup}>
                            <div className={styles.quickFilterHeader}>
                                <span>{label}</span>
                                {filters[key] !== 'all' && (
                                    <button type="button" onClick={() => updateFilter(key, 'all')} className={styles.clearLink}>
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div className={styles.quickSelectShell}>
                                <select
                                    className={styles.quickSelectControl}
                                    value={filters[key]}
                                    onChange={(event) => updateFilter(key, event.target.value)}
                                >
                                    <option value="all">All</option>
                                    {optionList.map((option) => {
                                        return (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className={classNames(styles.advancedPanel, showFilters && styles.advancedPanelVisible)}>
                <div className={styles.advancedGrid}>
                    <label className={styles.advancedField}>
                        <span className={styles.advancedLabel}>Developer</span>
                        <select className={styles.filterSelect} value={filters.developer} onChange={(e) => updateFilter('developer', e.target.value)}>
                            <option value="all">All</option>
                            {options.developers.map((developer) => {
                                const count = filterCounts.developer.get(developer.value);
                                return (
                                    <option key={developer.value} value={developer.value}>
                                        {count ? `${developer.label} (${numberFormatter.format(count)})` : developer.label}
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
                                const count = filterCounts.aircraft.get(aircraftType.value);
                                return (
                                    <option key={aircraftType.value} value={aircraftType.value}>
                                        {count ? `${aircraftType.label} (${numberFormatter.format(count)})` : aircraftType.label}
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
                            {options.simulators.map((simulator) => {
                                const count = filterCounts.simulator.get(simulator.value);
                                const disabled = !pathEnabledSimulators.includes(simulator.label.toUpperCase() as Simulator);
                                return (
                                    <option key={simulator.value} value={simulator.value} disabled={disabled}>
                                        {count ? `${simulator.label} (${numberFormatter.format(count)})` : simulator.label}
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
                                const count = filterCounts.resolution.get(resolution.value);
                                return (
                                    <option key={resolution.value} value={resolution.value}>
                                        {count ? `${resolution.label} (${numberFormatter.format(count)})` : resolution.label}
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

            <div className={styles.scrollContainer}>
                <div className={styles.paginationBar}>
                    <span className={styles.paginationText}>
                        Found: <strong>{dedupedLiveries.length}</strong> liver{dedupedLiveries.length !== 1 ? 'ies' : 'y'}. Page <strong>{page}</strong> of <strong>{totalPages}</strong>.
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

                {(loading || liveriesFetching) ? (
                    <p className={styles.loading}>Loading liveries…</p>
                ) : !hasSimulatorPathConfigured ? (
                    <p className={styles.emptyState}>Add a simulator path in Settings to see liveries.</p>
                ) : paginated.length ? (
                    <div className={styles.grid}>
                        {paginated.map((livery) => (
                            <LiveryCard
                                key={livery.id ?? livery.name}
                                livery={livery}
                                defaultResolution={settings.defaultResolution}
                                defaultSimulator={activeSimulatorCode ?? settings.defaultSimulator}
                                resolutionFilter={
                                    filters.resolution === 'all'
                                        ? 'all'
                                        : ((valueMaps.resolution.get(filters.resolution) ?? filters.resolution) as Resolution)
                                }
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
        </section>
    );
};
