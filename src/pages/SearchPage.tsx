import { useCallback, useEffect, useMemo, useState } from 'react';
import { LiveryCard } from '@/components/LiveryCard';
import { ITEMS_PER_PAGE } from '@/utils/livery';
import type { Livery, InstalledLiveryRecord, Resolution, Simulator } from '@/types/livery';
import { useLiveryStore } from '@/store/liveryStore';
import { useAuthStore } from '@/store/authStore';
import { useCatalogQuery } from '@/hooks/useCatalogQuery';
import { useLiveriesQuery } from '@/hooks/useLiveriesQuery';
import { Toast } from '@/components/Toast';
import type { ReactNode } from 'react';
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
type ValueMaps = Record<FilterKey, Map<string, string>>;

const UNCATEGORIZED = '__uncategorized';

const dedupeOptions = (entries: ChipOption[]) => {
    const map = new Map<string, ChipOption>();
    entries.forEach(({ value, label, hint }) => {
        if (!value) return;
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
        simulators: dedupeOptions(liveries.map((l) => ({
            value: l.simulatorId,
            label: l.simulatorCode || l.simulatorId
        }))),
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
            if (value) map.set(value, value);
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
    installedLiveries: InstalledLiveryRecord[]
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
        const isVariantInstalled = (livery: Livery) => {
            return !!installedLiveries.find((l) => l.liveryId === livery.id);
        };
        return matches.filter((livery) => isVariantInstalled(livery));
    }

    return matches;
};

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

const classNames = (...tokens: Array<string | false | undefined>) => tokens.filter(Boolean).join(' ');

const SearchIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M11 3a8 8 0 0 1 8 8c0 1.848-.627 3.55-1.68 4.905l3.386 3.388a1 1 0 0 1-1.414 1.414l-3.388-3.386A7.96 7.96 0 0 1 11 19a8 8 0 1 1 0-16z" />
    </svg>
);

const CloseIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

const FilterIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
);

export const SearchPage = () => {
    const liveries = useLiveryStore((state) => state.liveries);
    const installedLiveries = useLiveryStore((state) => state.installedLiveries);
    const loading = useLiveryStore((state) => state.loading);
    const error = useLiveryStore((state) => state.error);
    const clearError = useLiveryStore((state) => state.clearError);
    const settings = useLiveryStore((state) => state.settings);
    const downloadStates = useLiveryStore((state) => state.downloadStates);
    const handleDownload = useLiveryStore((state) => state.handleDownload);
    const cancelDownload = useLiveryStore((state) => state.cancelDownload);
    const handleUninstall = useLiveryStore((state) => state.handleUninstall);
    const isVariantInstalled = useLiveryStore((state) => state.isVariantInstalled);
    const authToken = useAuthStore((state) => state.token);
    const authError = useAuthStore((state) => state.error);
    const clearAuthError = useAuthStore((state) => state.setError);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [warningMessage, setWarningMessage] = useState<ReactNode | null>(null);

    const pathEnabledSimulators = useMemo<Simulator[]>(() => {
        const sims: Simulator[] = [];
        if (settings.msfs2020Path) sims.push('FS20');
        if (settings.msfs2024Path) sims.push('FS24');
        return sims;
    }, [settings.msfs2020Path, settings.msfs2024Path]);

    const [filters, setFilters] = useState<FilterState>(() => createDefaultFilters(''));
    const [page, setPage] = useState(1);
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
        FS20: 'FS20.webp',
        FS24: 'FS24.webp'
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

    // Count active filters (excluding simulator which is always set)
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.developer !== 'all') count++;
        if (filters.aircraft !== 'all') count++;
        if (filters.engine !== 'all') count++;
        if (filters.resolution !== 'all') count++;
        if (filters.category !== 'all') count++;
        return count;
    }, [filters]);

    // Build active filter badges for display
    const activeFilterBadges = useMemo(() => {
        const badges: Array<{ key: FilterKey; label: string; displayValue: string }> = [];
        const filterDefs: Array<{ key: FilterKey; label: string }> = [
            { key: 'developer', label: 'Developer' },
            { key: 'aircraft', label: 'Aircraft' },
            { key: 'engine', label: 'Engine' },
            { key: 'resolution', label: 'Resolution' },
            { key: 'category', label: 'Category' },
        ];
        for (const { key, label } of filterDefs) {
            const value = filters[key];
            if (value && value !== 'all') {
                const displayValue = valueMaps[key].get(value) ?? value;
                badges.push({ key, label, displayValue });
            }
        }
        return badges;
    }, [filters, valueMaps]);

    const filteredLiveries = useMemo(
        () =>
            hasSimulatorSelection
                ? filterLiveries(
                    liveries,
                    filters,
                    searchTerm,
                    viewMode,
                    installedLiveries,
                )
                : [],
        [filters, hasSimulatorSelection, isVariantInstalled, liveries, searchTerm, settings.defaultResolution, settings.defaultSimulator, viewMode]
    );

    const dedupedLiveries = useMemo(
        () => dedupeLiveriesForDisplay(filteredLiveries, settings.defaultResolution).sort((liveryA, liveryB) => liveryA.name.localeCompare(liveryB.name)),
        [filteredLiveries, settings.defaultResolution]
    );

    const totalPages = Math.max(1, Math.ceil(dedupedLiveries.length / ITEMS_PER_PAGE));
    const paginated = dedupedLiveries.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    // Build page numbers to show (max 5 visible, with ellipsis)
    const pageNumbers = useMemo(() => {
        const pages: Array<number | 'ellipsis'> = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible + 2) {
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

    const startItem = (page - 1) * ITEMS_PER_PAGE + 1;
    const endItem = Math.min(page * ITEMS_PER_PAGE, dedupedLiveries.length);

    const updateFilter = (key: FilterKey, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
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

    const clearAllFilters = () => {
        setFilters((prev) => ({
            ...baseFilters,
            simulator: prev.simulator
        }));
        setSearchTerm('');
        setPage(1);
    };

    return (
        <section className={styles.page}>
            {/* Header */}
            <div id="filterSection" >
                <header className={styles.pageHeader}>
                    <div className={styles.headerLeft}>
                        <div className={styles.headerTitleRow}>
                            {simulatorLogoKey && (
                                <div className={styles.simulatorLogoWrap} aria-hidden>
                                    <img
                                        src={simulatorLogoMap[simulatorLogoKey] ?? ''}
                                        alt={simulatorLogoKey === 'FS24' ? 'Microsoft Flight Simulator 2024' : 'Microsoft Flight Simulator 2020'}
                                        className={styles.simulatorLogo}
                                    />
                                    <div className={styles.headerCount}>
                                        <h1 className={styles.title}>Liveries</h1>
                                        {hasSimulatorSelection && (
                                            <p className={styles.resultCount}>
                                                <strong>{numberFormatter.format(dedupedLiveries.length)}</strong> {dedupedLiveries.length === 1 ? 'livery' : 'liveries'} found
                                                {searchTerm && <span className={styles.searchTermHint}> for &ldquo;{searchTerm}&rdquo;</span>}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                    <div className={styles.headerRight}>
                        <div className={styles.viewToggle}>
                            <button
                                type="button"
                                className={classNames(styles.viewToggleButton, viewMode === 'all' && styles.viewToggleButtonActive)}
                                onClick={() => { setViewMode('all'); setPage(1); }}
                            >
                                All
                            </button>
                            <button
                                type="button"
                                className={classNames(styles.viewToggleButton, viewMode === 'installed' && styles.viewToggleButtonActive)}
                                onClick={() => { setViewMode('installed'); setPage(1); }}
                            >
                                Installed
                            </button>
                        </div>
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

                {warningMessage && (
                    <Toast
                        type="warning"
                        message={warningMessage}
                        onClose={() => setWarningMessage(null)}
                    />
                )}

                {/* Search + Filters toolbar */}
                <div className={styles.toolbar}>
                    <div className={styles.searchBar}>
                        <div className={styles.searchInputWrap}>
                            <span className={styles.searchIconInline}><SearchIcon /></span>
                            <input
                                value={searchTerm}
                                onChange={(event) => {
                                    setSearchTerm(event.target.value);
                                    setPage(1);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') handleSearchSubmit();
                                }}
                                placeholder="Search by name, developer, or aircraft…"
                                className={styles.searchInput}
                                type="search"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    className={styles.clearSearchButton}
                                    onClick={() => { setSearchTerm(''); setPage(1); }}
                                    aria-label="Clear search"
                                >
                                    <CloseIcon />
                                </button>
                            )}
                        </div>
                        <button
                            id="filters"
                            type="button"
                            className={classNames(styles.filterToggle, (showFilters || activeFilterCount > 0) && styles.filterToggleActive)}
                            onClick={() => setShowFilters(!showFilters)}
                            aria-label="Toggle filters"
                        >
                            <FilterIcon />
                            <span>Filters</span>
                            {activeFilterCount > 0 && (
                                <span className={styles.filterCount}>{activeFilterCount}</span>
                            )}
                        </button>
                    </div>

                    {/* Simulator selector - always visible */}
                    <div id="simulatorResolutionSelect" className={styles.simSelectorRow}>
                        {simulatorOptions.map((option) => {
                            const disabled = !pathEnabledSimulators.includes(option.label.toUpperCase() as Simulator);
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={classNames(styles.simChip, filters.simulator === option.value && styles.simChipActive)}
                                    disabled={disabled}
                                    onClick={() => !disabled && handleQuickSelect('simulator', option.value)}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                        {resolutionOptions.length > 0 && (
                            <>
                                <span className={styles.simDivider} />
                                {resolutionOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={classNames(styles.simChip, filters.resolution === option.value && styles.simChipActive)}
                                        onClick={() => handleQuickSelect('resolution', option.value)}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {catalogLoading && <p className={styles.catalogStatus}>Refreshing catalog metadata…</p>}
            {!hasSimulatorPathConfigured && (
                <p className={classNames(styles.catalogStatus, styles.catalogStatusError)}>
                    Configure a simulator path in Settings to browse and install liveries.
                </p>
            )}

            {/* Expandable filter panel */}
            <div>
                <div className={classNames(styles.filterPanel, showFilters && styles.filterPanelOpen, activeFilterBadges.length > 0 && showFilters && styles.filterPanelWithBadges)}>
                    <div className={styles.filterGrid}>
                        <div className={styles.filterField}>
                            <label className={styles.filterLabel}>Developer</label>
                            <select
                                className={styles.filterSelect}
                                value={filters.developer}
                                onChange={(e) => updateFilter('developer', e.target.value)}
                            >
                                <option value="all">All developers</option>
                                {developerOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.filterField}>
                            <label className={styles.filterLabel}>Aircraft</label>
                            <select
                                className={styles.filterSelect}
                                value={filters.aircraft}
                                onChange={(e) => updateFilter('aircraft', e.target.value)}
                            >
                                <option value="all">All aircraft</option>
                                {aircraftOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.filterField}>
                            <label className={styles.filterLabel}>Category</label>
                            <select
                                className={styles.filterSelect}
                                value={filters.category}
                                onChange={(e) => updateFilter('category', e.target.value)}
                            >
                                <option value="all">All categories</option>
                                {categoryOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        {engineOptions.length > 0 && (
                            <div className={styles.filterField}>
                                <label className={styles.filterLabel}>Engine</label>
                                <select
                                    className={styles.filterSelect}
                                    value={filters.engine}
                                    onChange={(e) => updateFilter('engine', e.target.value)}
                                >
                                    <option value="all">All engines</option>
                                    {engineOptions.map((eng) => (
                                        <option key={eng} value={eng}>{eng}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>
                {activeFilterBadges.length > 0 && (
                    <div className={styles.activeFilters}>
                        {activeFilterBadges.map(({ key, label, displayValue }) => (
                            <button
                                key={key}
                                type="button"
                                className={styles.filterBadge}
                                onClick={() => updateFilter(key, 'all')}
                                title={`Remove ${label} filter`}
                            >
                                <span className={styles.filterBadgeLabel}>{label}:</span>
                                <span>{displayValue}</span>
                                <CloseIcon />
                            </button>
                        ))}
                        {activeFilterBadges.length > 1 && (
                            <button type="button" className={styles.clearAllLink} onClick={clearAllFilters}>
                                Clear all
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Results */}
            <div className={styles.scrollContainer}>
                <div className={styles.paginationBar}>
                    <span className={styles.paginationText}>
                        {dedupedLiveries.length > 0 ? (
                            <>Showing <strong>{startItem}–{endItem}</strong> of <strong>{dedupedLiveries.length}</strong></>
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

                {(loading || liveriesFetching) ? (
                    <div className={styles.loadingState}>
                        <div className={styles.spinner} />
                        <p>Loading liveries…</p>
                    </div>
                ) : !hasSimulatorPathConfigured ? (
                    <div className={styles.emptyState}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
                            <path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4A2 2 0 0 1 2 16.76V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0z" />
                            <polyline points="2.32 6.16 12 11 21.68 6.16" />
                            <line x1="12" y1="22.76" x2="12" y2="11" />
                        </svg>
                        <p>Add a simulator path in Settings to see liveries.</p>
                    </div>
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
                                onDownload={(resolution: Resolution, simulator: Simulator) => {
                                    if (livery.aircraftProfileName === 'A35K') {
                                        setWarningMessage(
                                            <>
                                                Note: The A350-1000 livery require additional configuration. Learn more:{' '}
                                                <a href="https://flightsim.to/addon/105315/a35k-speedcore" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                                                    A35K Speedcore
                                                </a>
                                            </>
                                        );
                                    }
                                    return handleDownload(livery, resolution, simulator);
                                }}
                                onCancelDownload={() => cancelDownload(livery.id, livery.name)}
                                onUninstall={(resolution: Resolution, simulator: Simulator) => handleUninstall(livery, resolution, simulator)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className={styles.emptyState}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <p>No liveries match your filters.</p>
                        {activeFilterCount > 0 && (
                            <button type="button" className={styles.emptyStateAction} onClick={clearAllFilters}>
                                Clear all filters
                            </button>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
};
