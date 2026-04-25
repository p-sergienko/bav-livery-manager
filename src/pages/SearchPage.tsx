import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {LiveryCard} from '@/components/LiveryCard';
import {LiveryCardSkeleton} from '@/components/LiveryCardSkeleton';
import {ITEMS_PER_PAGE} from '@/utils/livery';
import type {Livery, InstalledLiveryRecord, Resolution, Simulator} from '@/types/livery';
import {useLiveryStore} from '@/store/liveryStore';
import {useAuthStore} from '@/store/authStore';
import {useCatalogQuery} from '@/hooks/useCatalogQuery';
import {useLiveriesQuery} from '@/hooks/useLiveriesQuery';
import {Toast} from '@/components/Toast';
import {FilterPanel} from '@/components/FilterPanel';
import {SearchBar} from '@/components/SearchBar';
import {useFilterStore} from '@/store/filterStore';
import {useDebounce} from '@/hooks/useDebounce';
import type {FilterKey, FilterState} from '@/store/filterStore';
import type {ReactNode} from 'react';
import styles from './SearchPage.module.css';

const uniqueStrings = (values: Array<string | null | undefined>) => {
    const set = new Set<string>();
    values.forEach((value) => {
        if (value && value.trim()) {
            set.add(value.trim());
        }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'}));
};

interface ChipOption {
    value: string;
    label: string;
    hint?: string | null;
}

type ValueMaps = Record<FilterKey, Map<string, string>>;

const UNCATEGORIZED = '__uncategorized';

const dedupeOptions = (entries: ChipOption[]) => {
    const map = new Map<string, ChipOption>();
    entries.forEach(({value, label, hint}) => {
        if (!value) return;
        if (!map.has(value)) {
            map.set(value, {value, label, hint: hint ?? null});
        }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, undefined, {sensitivity: 'base'}));
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
        categories.push({value: UNCATEGORIZED, label: 'Uncategorized'});
    }

    return {
        developers: dedupeOptions(liveries.map((l) => ({value: l.developerId, label: l.developerName}))),
        aircraft: dedupeOptions(liveries.map((l) => ({value: l.aircraftProfileId, label: l.aircraftProfileName}))),
        engines: uniqueStrings(liveries.map((l) => l.engine)),
        simulators: dedupeOptions(liveries.map((l) => ({
            value: l.simulatorId,
            label: l.simulatorCode || l.simulatorId
        }))),
        resolutions: dedupeOptions(liveries.map((l) => ({value: l.resolutionId, label: l.resolutionValue}))),
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

const scoreSearch = (livery: Livery, tokens: string[]): number => {
    if (tokens.length === 0) return 1;
    let total = 0;
    const check = (field: string | null | undefined, w: number) => {
        const f = (field ?? '').toLowerCase();
        if (!f) return 0;
        if (f === tokens[0] && tokens.length === 1) return w * 4
        return 0;
    };
    void check;
    for (const token of tokens) {
        const scores = [
            scoreField(livery.name, token, 10),
            scoreField(livery.title, token, 10),
            scoreField(livery.developerName, token, 7),
            scoreField(livery.aircraftProfileName, token, 9),
            scoreField(livery.categoryName, token, 5),
            scoreField(livery.simulatorCode, token, 3),
            scoreField(livery.resolutionValue, token, 2),
        ];
        const best = Math.max(...scores);
        if (best === 0) return 0;
        total += best;
    }
    return total;
};

const scoreField = (field: string | null | undefined, token: string, weight: number): number => {
    const f = (field ?? '').toLowerCase();
    if (!f) return 0;
    if (f === token) return weight * 3;
    if (f.startsWith(token)) return weight * 2;
    if (f.includes(token)) return weight;
    return 0;
};

const filterLiveries = (
    liveries: Livery[],
    filters: FilterState,
    searchTerm: string,
    viewMode: 'all' | 'installed',
    installedLiveries: InstalledLiveryRecord[]
) => {
    const tokens = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = liveries.filter((livery) => {
        const matchesSearch = scoreSearch(livery, tokens) > 0;

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

const numberFormatter = new Intl.NumberFormat(undefined, {maximumFractionDigits: 0});

const classNames = (...tokens: Array<string | false | undefined>) => tokens.filter(Boolean).join(' ');



const CloseIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
);


export const SearchPage = () => {
    const authToken = useAuthStore((state) => state.token);
    const authError = useAuthStore((state) => state.error);
    const clearAuthError = useAuthStore((state) => state.setError);

    const {data: catalog, isFetching: catalogLoading, error: catalogError} = useCatalogQuery(authToken);
    const {data: liveriesData, isFetching: liveriesFetching, error: listError} = useLiveriesQuery();

    const liveries = useMemo(() => liveriesData ?? [], [liveriesData]);

    const installedLiveries = useLiveryStore((state) => state.installedLiveries);
    const settings = useLiveryStore((state) => state.settings);
    const handleDownload = useLiveryStore((state) => state.handleDownload);
    const cancelDownload = useLiveryStore((state) => state.cancelDownload);
    const handleUninstall = useLiveryStore((state) => state.handleUninstall);
    const isVariantInstalled = useLiveryStore((state) => state.isVariantInstalled);
    const storeError = useLiveryStore((state) => state.error);
    const clearStoreError = useLiveryStore((state) => state.clearError);

    const loading = catalogLoading || liveriesFetching;
    const error = listError ? listError.message : (catalogError ? catalogError.message : storeError);
    const clearError = () => {
        if (storeError) clearStoreError();
    };

    const filters = useFilterStore((s) => s.filters);
    const setFilter = useFilterStore((s) => s.setFilter);
    const searchTerm = useFilterStore((s) => s.searchTerm);
    const setSearchTerm = useFilterStore((s) => s.setSearchTerm);
    const debouncedSearchTerm = useDebounce(searchTerm, 150);
    const viewMode = useFilterStore((s) => s.viewMode);
    const setViewMode = useFilterStore((s) => s.setViewMode);
    const storeClearFilters = useFilterStore((s) => s.clearFilters);
    const [warningMessage, setWarningMessage] = useState<ReactNode | null>(null);

    const pathEnabledSimulators = useMemo<Simulator[]>(() => {
        const sims: Simulator[] = [];
        if (settings.msfs2020Path) sims.push('FS20');
        if (settings.msfs2024Path) sims.push('FS24');
        return sims;
    }, [settings.msfs2020Path, settings.msfs2024Path]);

    const [displayedPages, setDisplayedPages] = useState([1]);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const contentAreaRef = useRef<HTMLDivElement>(null);

    const fallbackOptions = useMemo(() => buildFallbackOptions(liveries), [liveries]);

    const developerOptions = useMemo<ChipOption[]>(() => {
        if (catalog?.developers?.length) {
            const entries = catalog.developers
                .filter((dev) => dev.id && dev.name)
                .map((dev) => ({value: dev.id, label: dev.name}));
            return dedupeOptions(entries);
        }
        return fallbackOptions.developers;
    }, [catalog?.developers, fallbackOptions.developers]);

    const aircraftOptions = useMemo<ChipOption[]>(() => {
        if (catalog?.aircraft?.length) {
            const entries = catalog.aircraft
                .filter((air) => air.id && air.name)
                .map((air) => ({value: air.id, label: air.name}));
            return dedupeOptions(entries);
        }
        return fallbackOptions.aircraft;
    }, [catalog?.aircraft, fallbackOptions.aircraft]);

    const engineOptions = useMemo(() => fallbackOptions.engines, [fallbackOptions.engines]);

    const simulatorOptions = useMemo<ChipOption[]>(() => {
        const catalogOptions = (catalog?.simulators ?? [])
            .filter((sim) => sim.id && sim.code)
            .map((sim) => ({value: sim.id, label: sim.code}));

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
                .map((res) => ({value: res.id, label: res.value}));
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
            combined.push({value: UNCATEGORIZED, label: 'Uncategorized'});
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
                setFilter('simulator', '');
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
            setFilter('simulator', next);
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
            {key: 'developer', label: 'Developer'},
            {key: 'aircraft', label: 'Aircraft'},
            {key: 'engine', label: 'Engine'},
            {key: 'resolution', label: 'Resolution'},
            {key: 'category', label: 'Category'},
        ];
        for (const {key, label} of filterDefs) {
            const value = filters[key];
            if (value && value !== 'all') {
                const displayValue = valueMaps[key].get(value) ?? value;
                badges.push({key, label, displayValue});
            }
        }
        return badges;
    }, [filters, valueMaps]);

    const filterCounts = useMemo(() => {
        const empty = () => new Map<string, number>();
        if (!hasSimulatorSelection) {
            return {developer: empty(), aircraft: empty(), engine: empty(), category: empty(), totals: {developer: 0, aircraft: 0, engine: 0, category: 0}};
        }
        const countBy = (items: Livery[], keyFn: (l: Livery) => string | null | undefined) => {
            const map = new Map<string, number>();
            items.forEach((l) => {
                const key = keyFn(l);
                if (key != null && key !== '') map.set(key, (map.get(key) ?? 0) + 1);
            });
            return map;
        };
        const baseDev = filterLiveries(liveries, {...filters, developer: 'all'}, debouncedSearchTerm, viewMode, installedLiveries);
        const baseAir = filterLiveries(liveries, {...filters, aircraft: 'all'}, debouncedSearchTerm, viewMode, installedLiveries);
        const baseEng = filterLiveries(liveries, {...filters, engine: 'all'}, debouncedSearchTerm, viewMode, installedLiveries);
        const baseCat = filterLiveries(liveries, {...filters, category: 'all'}, debouncedSearchTerm, viewMode, installedLiveries);
        return {
            developer: countBy(baseDev, (l) => l.developerId),
            aircraft: countBy(baseAir, (l) => l.aircraftProfileId),
            engine: countBy(baseEng, (l) => l.engine),
            category: countBy(baseCat, (l) => l.categoryId ?? l.categoryName ?? (!(l.categoryId || l.categoryName) ? '__uncategorized' : null)),
            totals: {developer: baseDev.length, aircraft: baseAir.length, engine: baseEng.length, category: baseCat.length},
        };
    }, [filters, hasSimulatorSelection, installedLiveries, liveries, debouncedSearchTerm, viewMode]);

    const filteredLiveries = useMemo(
        () =>
            hasSimulatorSelection
                ? filterLiveries(liveries, filters, debouncedSearchTerm, viewMode, installedLiveries)
                : [],
        [filters, hasSimulatorSelection, liveries, debouncedSearchTerm, viewMode, installedLiveries]
    );

    const dedupedLiveries = useMemo(() => {
        const deduped = dedupeLiveriesForDisplay(filteredLiveries, settings.defaultResolution);
        if (!debouncedSearchTerm.trim()) {
            return deduped.sort((a, b) => a.name.localeCompare(b.name));
        }
        const tokens = debouncedSearchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
        return deduped.sort((a, b) => scoreSearch(b, tokens) - scoreSearch(a, tokens));
    }, [filteredLiveries, settings.defaultResolution, debouncedSearchTerm]);

    const totalPages = Math.max(1, Math.ceil(dedupedLiveries.length / ITEMS_PER_PAGE));
    const lastPage = displayedPages[displayedPages.length - 1];
    const hasMore = lastPage < totalPages;

    const [currentPage, setCurrentPage] = useState(1);

    const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endItem = Math.min(currentPage * ITEMS_PER_PAGE, dedupedLiveries.length);

    const pageNumbers = useMemo(() => {
        const pages: Array<number | 'ellipsis'> = [];
        const maxVisible = 5;
        if (totalPages <= maxVisible + 2) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            if (start > 2) pages.push('ellipsis');
            for (let i = start; i <= end; i++) pages.push(i);
            if (end < totalPages - 1) pages.push('ellipsis');
            pages.push(totalPages);
        }
        return pages;
    }, [currentPage, totalPages]);

    const handleScroll = useCallback(() => {
        const container = contentAreaRef.current;
        if (!container) return;

        // Track which page is currently visible
        const containerTop = container.getBoundingClientRect().top;
        const sections = container.querySelectorAll<HTMLElement>('[data-page]');
        let detected = displayedPages[0] ?? 1;
        sections.forEach((el) => {
            if (el.getBoundingClientRect().top <= containerTop + 80) {
                detected = Number(el.dataset.page);
            }
        });
        setCurrentPage(detected);

        // Append next page when the user has scrolled fully to the bottom
        const {scrollTop, scrollHeight, clientHeight} = container;
        if (hasMore && scrollHeight - scrollTop - clientHeight <= 1) {
            setDisplayedPages((prev) => {
                const next = prev[prev.length - 1] + 1;
                if (next > totalPages || prev.includes(next)) return prev;
                return [...prev, next];
            });
        }
    }, [displayedPages, hasMore, totalPages]);

    const jumpToPage = (n: number) => {
        setDisplayedPages([n]);
        setCurrentPage(n);
        contentAreaRef.current?.scrollTo({top: 0, behavior: 'instant'});
    };

    useEffect(() => {
        setDisplayedPages([1]);
        setCurrentPage(1);
        contentAreaRef.current?.scrollTo({top: 0, behavior: 'instant'});
    }, [dedupedLiveries]);

    useEffect(() => {
        handleScroll();
    }, [displayedPages, handleScroll]);

    const updateFilter = (key: FilterKey, value: string) => {
        setFilter(key, value);
    };

    const handleQuickSelect = (key: FilterKey, value: string) => {
        if (key === 'simulator') {
            updateFilter(key, value);
            return;
        }
        updateFilter(key, filters[key] === value ? 'all' : value);
    };

    const clearAllFilters = () => {
        storeClearFilters();
    };

    return (
        <section className={styles.page}>
            {/* Header */}
            <div id="filterSection">
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
                                                {searchTerm && <span
                                                    className={styles.searchTermHint}> for &ldquo;{searchTerm}&rdquo;</span>}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                    <div className={styles.viewToggle}>
                        <h4>Display liveries:</h4>
                        <button
                            type="button"
                            className={classNames(styles.simChip, viewMode === 'all' && styles.simChipActive)}
                            onClick={() => setViewMode('all')}
                        >
                            All
                        </button>
                        <button
                            type="button"
                            className={classNames(styles.simChip, viewMode === 'installed' && styles.simChipActive)}
                            onClick={() => setViewMode('installed')}
                        >
                            Installed
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

                {warningMessage && (
                    <Toast
                        type="warning"
                        message={warningMessage}
                        onClose={() => setWarningMessage(null)}
                    />
                )}

                <div className={styles.toolbar}>
                    <SearchBar
                        value={searchTerm}
                        onChange={(v) => setSearchTerm(v)}
                    />
 
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
                                <span className={styles.simDivider}/>
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
                        <span className={styles.simDivider}/>
                        <FilterPanel
                            filters={filters}
                            developerOptions={developerOptions}
                            aircraftOptions={aircraftOptions}
                            engineOptions={engineOptions}
                            categoryOptions={categoryOptions}
                            filterCounts={filterCounts}
                            onFilterChange={updateFilter}
                        />
                    </div>
                </div>
            </div>

            {catalogLoading && <p className={styles.catalogStatus}>Refreshing catalog metadata…</p>}
            {!hasSimulatorPathConfigured && (
                <p className={classNames(styles.catalogStatus, styles.catalogStatusError)}>
                    Configure a simulator path in Settings to browse and install liveries.
                </p>
            )}

            {/* Active filter badges */}
            {activeFilterBadges.length > 0 && (
                <div className={styles.activeFilters}>
                    {activeFilterBadges.map(({key, label, displayValue}) => (
                        <button
                            key={key}
                            type="button"
                            className={styles.filterBadge}
                            onClick={() => updateFilter(key, 'all')}
                            title={`Remove ${label} filter`}
                        >
                            <span className={styles.filterBadgeLabel}>{label}:</span>
                            <span>{displayValue}</span>
                            <CloseIcon/>
                        </button>
                    ))}
                    {activeFilterBadges.length > 1 && (
                        <button type="button" className={styles.clearAllLink} onClick={clearAllFilters}>
                            Clear all
                        </button>
                    )}
                </div>
            )}

            <div className={styles.scrollContainer}>
                <div className={styles.paginationBar}>
                    <span className={styles.paginationText}>
                        {dedupedLiveries.length > 0 ? (
                            <>Showing <strong>{startItem}–{endItem}</strong> of <strong>{dedupedLiveries.length}</strong></>
                        ) : (
                            loading || liveriesFetching ? (
                                <>Loading liveries... please stand-by</>
                            ) : (
                                <>No results</>
                            )
                        )}
                    </span>
                    {totalPages > 1 && (
                        <div className={styles.paginationButtons}>
                            <button type="button" onClick={() => jumpToPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1} aria-label="Previous page">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                     strokeWidth="1.5" aria-hidden>
                                    <path d="M15 18l-6-6 6-6"/>
                                </svg>
                            </button>
                            {pageNumbers.map((p, i) =>
                                p === 'ellipsis' ? (
                                    <span key={`e${i}`} className={styles.paginationEllipsis}>…</span>
                                ) : (
                                    <button
                                        key={p}
                                        type="button"
                                        className={classNames(styles.pageButton, p === currentPage && styles.pageButtonActive)}
                                        onClick={() => jumpToPage(p)}
                                    >
                                        {p}
                                    </button>
                                )
                            )}
                            <button type="button" onClick={() => jumpToPage(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages} aria-label="Next page">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                     strokeWidth="1.5" aria-hidden>
                                    <path d="M9 18l6-6-6-6"/>
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

                <div className={styles.contentArea} ref={contentAreaRef} onScroll={handleScroll}>
                {(loading || liveriesFetching) ? (
                    <div className={styles.grid}>
                        {Array.from({length: ITEMS_PER_PAGE}).map((_, i) => (
                            <LiveryCardSkeleton key={i}/>
                        ))}
                    </div>
                ) : !hasSimulatorPathConfigured ? (
                    <div className={styles.emptyState}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="1" aria-hidden>
                            <path
                                d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4A2 2 0 0 1 2 16.76V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0z"/>
                            <polyline points="2.32 6.16 12 11 21.68 6.16"/>
                            <line x1="12" y1="22.76" x2="12" y2="11"/>
                        </svg>
                        <p>Add a simulator path in Settings to see liveries.</p>
                    </div>
                ) : dedupedLiveries.length ? (
                    <>
                        {displayedPages.map((pageNum, idx) => {
                            const pageItems = dedupedLiveries.slice(
                                (pageNum - 1) * ITEMS_PER_PAGE,
                                pageNum * ITEMS_PER_PAGE
                            );
                            return (
                                <div key={pageNum} data-page={pageNum}>
                                    {idx > 0 && (
                                        <div className={styles.pageDivider}>
                                            <span>Page {pageNum}</span>
                                        </div>
                                    )}
                                    <div className={styles.grid}>
                                        {pageItems.map((livery) => (
                                            <LiveryCard
                                                key={livery.id ?? livery.name}
                                                livery={livery}
                                                allLiveries={liveries}
                                                defaultResolution={settings.defaultResolution}
                                                defaultSimulator={activeSimulatorCode ?? settings.defaultSimulator}
                                                resolutionFilter={
                                                    filters.resolution === 'all'
                                                        ? 'all'
                                                        : ((valueMaps.resolution.get(filters.resolution) ?? filters.resolution) as Resolution)
                                                }
                                                isInstalled={(resolution, simulator) => isVariantInstalled(livery, resolution, simulator)}
                                                onDownload={(resolution: Resolution, simulator: Simulator) => {
                                                    if (livery.aircraftProfileName === 'A35K') {
                                                        setWarningMessage(
                                                            <>
                                                                Note: The A350-1000 livery require additional configuration. Learn
                                                                more:{' '}
                                                                <a href="https://flightsim.to/addon/105315/a35k-speedcore"
                                                                   onClick={(e) => {
                                                                       e.preventDefault();
                                                                       window.electronAPI?.openExternalLink('https://flightsim.to/addon/105315/a35k-speedcore');
                                                                   }}
                                                                   style={{textDecoration: 'underline'}}>
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
                                </div>
                            );
                        })}
                        <div ref={sentinelRef} className={styles.sentinel} aria-hidden>
                            {hasMore && (
                                <div className={styles.loadMoreIndicator}>
                                    <div className={styles.spinner}/>
                                    <span>Page {lastPage + 1}</span>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className={styles.emptyState}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="1" aria-hidden>
                            <circle cx="11" cy="11" r="8"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
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
            </div>
        </section>
    );
};
