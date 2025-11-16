import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export const AuthTokenListener = () => {
    const applyBrowserToken = useAuthStore((state) => state.applyBrowserToken);

    useEffect(() => {
        const api = window.electronAPI;
        if (!api?.onAuthToken) {
            return;
        }

        api.onAuthToken((payload) => {
            if (payload?.token) {
                applyBrowserToken(payload);
            }
        });

        return () => {
            api.onAuthToken?.(null);
        };
    }, [applyBrowserToken]);

    return null;
};
