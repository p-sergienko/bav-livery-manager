import { useEffect } from 'react';
import { useAppUpdateStore } from '@/store/appUpdateStore';
import type { AppUpdateStatus } from '@/types/electron-api';

export const AppUpdateListener = () => {
    const setUpdate = useAppUpdateStore((s) => s.setUpdate);

    useEffect(() => {
        const api = window.electronAPI;
        if (!api?.onAppUpdateStatus) return;

        api.onAppUpdateStatus((status: AppUpdateStatus) => {
            switch (status.status) {
                case 'checking':
                    setUpdate({ phase: 'checking' });
                    break;
                case 'available':
                    setUpdate({
                        phase: 'available',
                        version: status.version ?? 'unknown',
                        releaseDate: status.releaseDate,
                    });
                    break;
                case 'not-available':
                    setUpdate({ phase: 'up-to-date' });
                    break;
                case 'downloading':
                    setUpdate({
                        phase: 'downloading',
                        percent: status.percent ?? 0,
                        bytesPerSecond: status.bytesPerSecond ?? 0,
                        transferred: status.transferred ?? 0,
                        total: status.total ?? 0,
                    });
                    break;
                case 'downloaded':
                    setUpdate({ phase: 'downloaded', version: status.version ?? 'unknown' });
                    break;
                case 'error':
                    setUpdate({ phase: 'error', message: status.error ?? 'Unknown error' });
                    break;
            }
        });

        // Trigger automatic check on startup
        api.checkForAppUpdate?.().catch(() => {});

        return () => {
            api.removeAppUpdateListeners?.();
        };
    }, [setUpdate]);

    return null;
};
