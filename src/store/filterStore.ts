import {create} from 'zustand';

type FilterKey = 'developer' | 'aircraft' | 'engine' | 'simulator' | 'resolution' | 'category';
type FilterState = Record<FilterKey, string>;

const baseFilters: FilterState = {
    developer: 'all',
    aircraft: 'all',
    engine: 'all',
    simulator: '',
    resolution: 'all',
    category: 'all',
};

type ViewMode = 'all' | 'installed' | 'non-installed';

interface FilterStore {
    filters: FilterState;
    searchTerm: string;
    showFilters: boolean;
    viewMode: ViewMode;
    setFilter: (key: FilterKey, value: string) => void;
    setFilters: (updater: (prev: FilterState) => FilterState) => void;
    setSearchTerm: (term: string) => void;
    setShowFilters: (show: boolean) => void;
    setViewMode: (mode: ViewMode) => void;
    clearFilters: () => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
    filters: {...baseFilters},
    searchTerm: '',
    showFilters: false,
    viewMode: 'all',

    setFilter: (key, value) =>
        set((state) => ({filters: {...state.filters, [key]: value}})),

    setFilters: (updater) =>
        set((state) => ({filters: updater(state.filters)})),

    setSearchTerm: (term) => set({searchTerm: term}),

    setShowFilters: (show) => set({showFilters: show}),

    setViewMode: (mode) => set({viewMode: mode}),

    clearFilters: () =>
        set((state) => ({
            filters: {...baseFilters, simulator: state.filters.simulator},
            searchTerm: '',
        })),
}));

export {baseFilters};
export type {FilterKey, FilterState, ViewMode};
