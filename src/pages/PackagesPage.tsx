import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PackageCard } from '@/components/PackageCard';
import { LiveryCardSkeleton } from '@/components/LiveryCardSkeleton';
import { SearchBar } from '@/components/SearchBar';
import { Toast } from '@/components/Toast';
import { Pagination } from '@/components/Pagination';
import { ITEMS_PER_PAGE } from '@/utils/livery';
import { useDebounce } from '@/hooks/useDebounce';
import { usePackagesQuery } from '@/hooks/usePackagesQuery';
import { usePackageStore } from '@/store/packageStore';
import { useLiveryStore } from '@/store/liveryStore';
import { useAuthStore } from '@/store/authStore';
import type { Package } from '@/types/package';
import type { Simulator } from '@/types/livery';
import styles from './SearchPage.module.css';

const classNames = (...tokens: Array<string | false | undefined>) => tokens.filter(Boolean).join(' ');

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

const matchesSearch = (pkg: Package, tokens: string[]) => {
    if (tokens.length === 0) return true;
    const haystack = [pkg.title, pkg.description, pkg.category, pkg.aircraftProfileName, pkg.simulatorCode, ...(pkg.tags ?? [])]
        .filter((v): v is string => Boolean(v))
        .map((v) => v.toLowerCase())
        .join(' ');
    return tokens.every((token) => haystack.includes(token));
};

export const PackagesPage = () => {
    const authError = useAuthStore((state) => state.error);
    const clearAuthError = useAuthStore((state) => state.setError);

    const settings = useLiveryStore((state) => state.settings);
    const liveries = useLiveryStore((state) => state.liveries);
    const installedLiveries = useLiveryStore((state) => state.installedLiveries);
    const downloadStates = usePackageStore((state) => state.downloadStates);
    const installedPackages = usePackageStore((state) => state.installedPackages);
    const attachListener = usePackageStore((state) => state.attachListener);
    const refreshInstalled = usePackageStore((state) => state.refreshInstalled);
    const handleDownload = usePackageStore((state) => state.handleDownload);
    const cancelDownload = usePackageStore((state) => state.cancelDownload);
    const handleUninstall = usePackageStore((state) => state.handleUninstall);
    const storeError = usePackageStore((state) => state.error);
    const clearStoreError = usePackageStore((state) => state.clearError);

    const { data: packagesData, isFetching, error: listError } = usePackagesQuery();
    const packages = useMemo(() => packagesData ?? [], [packagesData]);

    useEffect(() => {
        attachListener();
        void refreshInstalled();
    }, [attachListener, refreshInstalled]);

    const findDependentLiveries = useCallback(
        (slug: string, simulator: Simulator) => {
            const installedIdsForSim = new Set(
                installedLiveries.filter((entry) => entry.simulator === simulator).map((entry) => entry.liveryId)
            );
            return liveries.filter((livery) => {
                if (!installedIdsForSim.has(livery.id)) return false;
                const required = livery.requiredPackagesResolved ?? [];
                return required.some((ref) => ref.slug === slug);
            });
        },
        [installedLiveries, liveries]
    );

    const isPackageInstalled = useCallback(
        (slug: string, simulator: Simulator) =>
            installedPackages.some((entry) => entry.slug === slug && entry.simulator === simulator),
        [installedPackages]
    );

    const pathEnabledSimulators = useMemo<Simulator[]>(() => {
        const sims: Simulator[] = [];
        if (settings.msfs2020Path) sims.push('FS20');
        if (settings.msfs2024Path) sims.push('FS24');
        return sims;
    }, [settings.msfs2020Path, settings.msfs2024Path]);

    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 150);
    const [category, setCategory] = useState<string>('all');

    const categoryOptions = useMemo(() => {
        const set = new Set<string>();
        packages.forEach((p) => {
            if (p.category) set.add(p.category);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }, [packages]);

    const filteredPackages = useMemo(() => {
        const tokens = debouncedSearchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
        return packages.filter((pkg) => {
            const matchesCategory = category === 'all' || pkg.category === category;
            return matchesCategory && matchesSearch(pkg, tokens);
        });
    }, [packages, debouncedSearchTerm, category]);

    const sortedPackages = useMemo(() => {
        return [...filteredPackages].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    }, [filteredPackages]);

    const [displayedPages, setDisplayedPages] = useState([1]);
    const [currentPage, setCurrentPage] = useState(1);
    const contentAreaRef = useRef<HTMLDivElement>(null);

    const totalPages = Math.max(1, Math.ceil(sortedPackages.length / ITEMS_PER_PAGE));
    const lastPage = displayedPages[displayedPages.length - 1];
    const hasMore = lastPage < totalPages;

    const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endItem = Math.min(currentPage * ITEMS_PER_PAGE, sortedPackages.length);

    const handleScroll = useCallback(() => {
        const container = contentAreaRef.current;
        if (!container) return;

        const containerTop = container.getBoundingClientRect().top;
        const sections = container.querySelectorAll<HTMLElement>('[data-page]');
        let detected = displayedPages[0] ?? 1;
        sections.forEach((el) => {
            if (el.getBoundingClientRect().top <= containerTop + 80) {
                detected = Number(el.dataset.page);
            }
        });
        setCurrentPage(detected);

        const { scrollTop, scrollHeight, clientHeight } = container;
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
        contentAreaRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    };

    useEffect(() => {
        setDisplayedPages([1]);
        setCurrentPage(1);
        contentAreaRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }, [sortedPackages]);

    useEffect(() => {
        handleScroll();
    }, [displayedPages, handleScroll]);

    const error = listError ? listError.message : storeError;
    const clearError = () => {
        if (storeError) clearStoreError();
    };

    const hasSimulatorPathConfigured = pathEnabledSimulators.length > 0;

    return (
        <section className={styles.page}>
            <div id="filterSection">
                <header className={styles.pageHeader}>
                    <div className={styles.headerLeft}>
                        <div className={styles.headerTitleRow}>
                            <div className={styles.simulatorLogoWrap} aria-hidden>
                                <div className={styles.headerCount}>
                                    <h1 className={styles.title}>Packages</h1>
                                    <p className={styles.resultCount}>
                                        <strong>{numberFormatter.format(sortedPackages.length)}</strong> {sortedPackages.length === 1 ? 'package' : 'packages'} found
                                        {searchTerm && <span className={styles.searchTermHint}> for &ldquo;{searchTerm}&rdquo;</span>}
                                    </p>
                                </div>
                            </div>
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

                <div className={styles.toolbar}>
                    <SearchBar value={searchTerm} onChange={setSearchTerm} />

                    <div className={styles.simSelectorRow}>

                        {categoryOptions.length > 0 && (
                            <>
                                <button
                                    type="button"
                                    className={classNames(styles.simChip, category === 'all' && styles.simChipActive)}
                                    onClick={() => setCategory('all')}
                                >
                                    All categories
                                </button>
                                {categoryOptions.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        className={classNames(styles.simChip, category === cat && styles.simChipActive)}
                                        onClick={() => setCategory(category === cat ? 'all' : cat)}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {!hasSimulatorPathConfigured && (
                <p className={classNames(styles.catalogStatus, styles.catalogStatusError)}>
                    Configure a simulator path in Settings before downloading packages.
                </p>
            )}

            <div className={styles.scrollContainer}>
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    startItem={startItem}
                    endItem={endItem}
                    total={sortedPackages.length}
                    loading={isFetching}
                    onJump={jumpToPage}
                />

                <div className={styles.contentArea} ref={contentAreaRef} onScroll={handleScroll}>
                    {isFetching ? (
                        <div className={styles.grid}>
                            {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                                <LiveryCardSkeleton key={i} />
                            ))}
                        </div>
                    ) : sortedPackages.length ? (
                        <>
                            {displayedPages.map((pageNum, idx) => {
                                const pageItems = sortedPackages.slice(
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
                                            {pageItems.map((pkg) => (
                                                <PackageCard
                                                    key={pkg.id}
                                                    pkg={pkg}
                                                    pathEnabledSimulators={pathEnabledSimulators}
                                                    downloadState={downloadStates[pkg.slug]}
                                                    isInstalled={(sim) => isPackageInstalled(pkg.slug, sim)}
                                                    findDependentLiveries={(sim) => findDependentLiveries(pkg.slug, sim)}
                                                    onDownload={(sim) => handleDownload(pkg, sim)}
                                                    onCancelDownload={() => cancelDownload(pkg.slug)}
                                                    onUninstall={(sim) => handleUninstall(pkg.slug, sim)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            {hasMore && (
                                <div className={styles.sentinel} aria-hidden>
                                    <div className={styles.loadMoreIndicator}>
                                        <div className={styles.spinner} />
                                        <span>Page {lastPage + 1}</span>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={styles.emptyState}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <p>No packages match your filters.</p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};
