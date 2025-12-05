import { useQuery } from '@tanstack/react-query';
import { REMOTE_CATALOG_URL } from '@shared/constants';
import type { CatalogResponse } from '@/types/catalog';

const CATALOG_ENDPOINT = process.env.NODE_ENV === 'development' ? '/api/catalog' : REMOTE_CATALOG_URL;

export const useCatalogQuery = (token: string | null) => {
    return useQuery<CatalogResponse>({
        queryKey: ['catalog', token],
        enabled: Boolean(token),
        queryFn: async () => {
            if (!token) {
                throw new Error('Missing auth token');
            }
            const response = await fetch(CATALOG_ENDPOINT, {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store'
            });

            if (response.status === 401 || response.status === 403) {
                const error: Error & { status?: number } = new Error('Unauthorized');
                error.status = response.status;
                throw error;
            }

            if (!response.ok) {
                throw new Error(`Catalog request failed with status ${response.status}`);
            }

            return response.json();
        },
        staleTime: 15 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1
    });
};
