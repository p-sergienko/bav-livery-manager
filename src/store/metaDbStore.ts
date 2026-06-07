import { create } from 'zustand';
import type { AircraftRecord } from '@/types/metaManifest';

interface DbStore {
    records: AircraftRecord[];
    isLoaded: boolean;
    load: () => Promise<void>;
    lookup: (registration: string) => AircraftRecord | null;
    upsert: (record: AircraftRecord) => void;
    remove: (registration: string) => void;
    save: () => Promise<boolean>;
}

export const useMetaDbStore = create<DbStore>((set, get) => ({
    records: [],
    isLoaded: false,

    load: async () => {
        const records = await window.electronAPI!.metaGetAircraftDb();
        set({ records, isLoaded: true });
    },

    lookup: (registration) => get().records.find((r) => r.registration === registration) ?? null,

    upsert: (record) => {
        set((state) => {
            const exists = state.records.some((r) => r.registration === record.registration);
            const records = exists
                ? state.records.map((r) => (r.registration === record.registration ? record : r))
                : [...state.records, record];
            return { records };
        });
    },

    remove: (registration) => {
        set((state) => ({ records: state.records.filter((r) => r.registration !== registration) }));
    },

    save: async () => window.electronAPI!.metaSaveAircraftDb(get().records),
}));
