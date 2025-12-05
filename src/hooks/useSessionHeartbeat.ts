import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PANEL_AUTH_ENDPOINT } from '@/config/auth';
import { useAuthStore } from '@/store/authStore';

const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export const useSessionHeartbeat = () => {
    const token = useAuthStore((state) => state.token);
    const logout = useAuthStore((state) => state.logout);
    const setError = useAuthStore((state) => state.setError);

    const query = useQuery({
        queryKey: ['session', 'heartbeat', token],
        enabled: Boolean(token),
        queryFn: async () => {
            if (!token) throw new Error('Missing auth token');
            const response = await fetch(PANEL_AUTH_ENDPOINT, {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                cache: 'no-store'
            });

            if (response.status === 401 || response.status === 403) {
                const error = new Error('Session expired');
                (error as Error & { status?: number }).status = response.status;
                throw error;
            }

            if (!response.ok) {
                throw new Error(`Session check failed (${response.status})`);
            }

            return response.json();
        },
        refetchInterval: HEARTBEAT_INTERVAL_MS,
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000
    });

    useEffect(() => {
        if (query.error) {
            console.warn('Session heartbeat failed; logging out', query.error);
            logout();
            setError('Session expired. Please log in again.');
        }
    }, [logout, query.error, setError]);

    useEffect(() => {
        if (query.data) {
            setError(null);
        }
    }, [query.data, setError]);

    // Run an eager check as soon as a token arrives.
    useEffect(() => {
        if (token) {
            query.refetch().catch((err) => console.warn('Initial heartbeat failed', err));
        }
    }, [token, query]);

    return query;
};
