import { create } from 'zustand';

interface AppUpdateState {
    checking: boolean;
    updateAvailable: boolean;
    updateInfo: {
        version: string;
        releaseDate: string;
        releaseNotes?: string;
    } | null;
    updateDownloaded: boolean;
    downloadedInfo: any | null;
    downloadProgress: number | null;
    downloadSpeed: string | null;
    error: string | null;

    setChecking: (checking: boolean) => void;
    setUpdateAvailable: (info: any) => void;
    setUpdateNotAvailable: () => void;
    setUpdateProgress: (progress: any) => void;
    setUpdateDownloaded: (info: any) => void;
    setError: (error: string | null) => void;
    checkForUpdates: () => Promise<void>;
    installUpdate: () => Promise<void>;
    restartAndUpdate: () => Promise<void>;
    dismissUpdate: () => void;
}

const getAPI = () => (typeof window === 'undefined' ? undefined : window.electronAPI);

export const useAppUpdateStore = create<AppUpdateState>((set, get) => ({
    checking: false,
    updateAvailable: false,
    updateInfo: null,
    updateDownloaded: false,
    downloadedInfo: null,
    downloadProgress: null,
    downloadSpeed: null,
    error: null,

    setChecking: (checking) => set({ checking }),
    setUpdateAvailable: (info) => set({
        updateAvailable: true,
        updateInfo: info,
        error: null
    }),
    setUpdateNotAvailable: () => set({
        checking: false,
        updateAvailable: false,
        error: null
    }),
    setUpdateProgress: (progress) => set({
        downloadProgress: progress.percent,
        downloadSpeed: progress.bytesPerSecond
            ? `${(progress.bytesPerSecond / 1024).toFixed(1)} KB/s`
            : null
    }),
    setUpdateDownloaded: (info) => set({
        updateDownloaded: true,
        downloadedInfo: info,
        downloadProgress: null,
        downloadSpeed: null,
        error: null
    }),
    setError: (error) => set({ error }),

    checkForUpdates: async () => {
        const api = getAPI();
        if (!api?.checkForUpdates) return;

        set({ checking: true, error: null });
        try {
            await api.checkForUpdates();
        } catch (error) {
            set({ error: 'Failed to check for updates' });
        } finally {
            set({ checking: false });
        }
    },

    installUpdate: async () => {
        const api = getAPI();
        if (!api?.installUpdate) return;

        try {
            await api.installUpdate();
        } catch (error) {
            set({ error: 'Failed to install update' });
        }
    },

    restartAndUpdate: async () => {
        const api = getAPI();
        if (!api?.restartAndUpdate) return;

        try {
            await api.restartAndUpdate();
        } catch (error) {
            set({ error: 'Failed to restart and update' });
        }
    },

    dismissUpdate: () => {
        set({
            updateDownloaded: false,
            downloadedInfo: null,
            updateAvailable: false,
            updateInfo: null
        });
    }
}));

export const useAppUpdateListener = () => {
    const {
        setChecking,
        setUpdateAvailable,
        setUpdateNotAvailable,
        setUpdateProgress,
        setUpdateDownloaded,
        setError
    } = useAppUpdateStore();

    const api = getAPI();

    if (api) {
        api.onUpdateChecking(() => setChecking(true));
        api.onUpdateAvailable((info) => setUpdateAvailable(info));
        api.onUpdateNotAvailable(() => setUpdateNotAvailable());
        api.onUpdateProgress((progress) => setUpdateProgress(progress));
        api.onUpdateDownloaded((info) => setUpdateDownloaded(info));
        api.onUpdateError((error) => setError(error));
    }
};