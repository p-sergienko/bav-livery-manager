import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { InstalledLiveryRecord } from '@/types/livery';
import { useLiveryStore } from '@/store/liveryStore';

const getAPI = () => (typeof window === 'undefined' ? undefined : window.electronAPI);

interface InstalledQueryResult {
    installedLiveries: InstalledLiveryRecord[];
}

export const useInstalledLiveriesQuery = () => {
    const query = useQuery<InstalledQueryResult>({
        queryKey: ['installed-liveries'],
        queryFn: async () => {
            const api = getAPI();
            if (!api?.getInstalledLiveries) {
                throw new Error('Electron APIs are not available.');
            }

            const entries = await api.getInstalledLiveries();
            return { installedLiveries: entries };
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
