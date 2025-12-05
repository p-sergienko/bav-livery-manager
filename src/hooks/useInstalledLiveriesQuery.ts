import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { InstalledLivery, Simulator } from '@/types/livery';
import { useLiveryStore } from '@/store/liveryStore';

const getAPI = () => (typeof window === 'undefined' ? undefined : window.electronAPI);

interface InstalledQueryResult {
    installedLiveries: InstalledLivery[];
}

export const useInstalledLiveriesQuery = () => {
    const settings = useLiveryStore((state) => state.settings);
    const paths = useMemo(() => {
        const candidates: Array<{ path: string; simulator: Simulator }> = [];
        if (settings.msfs2020Path) candidates.push({ path: settings.msfs2020Path, simulator: 'FS20' });
        if (settings.msfs2024Path) candidates.push({ path: settings.msfs2024Path, simulator: 'FS24' });
        return candidates;
    }, [settings.msfs2020Path, settings.msfs2024Path]);

    const query = useQuery<InstalledQueryResult>({
        queryKey: ['installed-liveries', paths],
        enabled: paths.length > 0,
        queryFn: async () => {
            const api = getAPI();
            if (!api?.getInstalledLiveries) {
                throw new Error('Electron APIs are not available.');
            }

            const all: InstalledLivery[] = [];
            for (const { path, simulator } of paths) {
                try {
                    const entries = await api.getInstalledLiveries(path);
                    entries.forEach((entry) => all.push({ ...entry, simulatorHint: simulator }));
                } catch (error) {
                    console.warn(`Failed to read installed liveries from ${path}`, error);
                }
            }

            return { installedLiveries: all };
        },
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1
    });

    useEffect(() => {
        if (query.data) {
            useLiveryStore.setState({ installedLiveries: query.data.installedLiveries });
        }
    }, [query.data]);

    useEffect(() => {
        if (query.error) {
            console.error('Failed to refresh installed liveries', query.error);
            useLiveryStore.setState({ installedLiveries: [] });
        }
    }, [query.error]);

    return query;
};
