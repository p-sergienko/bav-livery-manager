import { useEffect } from 'react';
import { create } from 'zustand';
import type {
    DownloadProgress,
    InstalledLiveryRecord,
    Livery,
    Resolution,
    Settings,
    Simulator
} from '@/types/livery';
import { useAuthStore } from '@/store/authStore';
import { buildDownloadRequestUrl, deriveInstallFolderName, joinPaths, normalizeRemoteLivery } from '@/utils/livery';
import { REMOTE_LIVERY_LIST_URL } from '@shared/constants';

const DEFAULT_SETTINGS: Settings = {
    msfs2020Path: '',
    msfs2024Path: '',
    defaultResolution: '4K',
    defaultSimulator: 'FS20'
};

const getAPI = () => (typeof window === 'undefined' ? undefined : window.electronAPI);

interface LiveryState {
    liveries: Livery[];
    installedLiveries: InstalledLiveryRecord[];
    settings: Settings;
    downloadStates: Record<string, DownloadProgress>;
    loading: boolean;
    error: string | null;
    initialized: boolean;
    downloadListenerAttached: boolean;
    initialize: () => Promise<void>;
    attachDownloadListener: () => void;
    loadSettings: () => Promise<void>;
    refreshLiveries: () => Promise<void>;
    refreshInstalled: () => Promise<void>;
    updateSettings: (partial: Partial<Settings>) => Promise<void>;
    handleDownload: (livery: Livery, resolution: Resolution, simulator: Simulator) => Promise<boolean>;
    handleUninstall: (livery: Livery, resolution: Resolution, simulator: Simulator) => Promise<boolean>;
    uninstallByPath: (installPath: string) => Promise<boolean>;
    uninstallEntry: (entry: InstalledLiveryRecord) => Promise<boolean>;
    isVariantInstalled: (livery: Livery, resolution: Resolution, simulator: Simulator) => boolean;
    clearError: () => void;
}

export const useLiveryStore = create<LiveryState>((set, get) => {
    const matchInstalledEntry = (livery: Livery, resolution: Resolution, simulator: Simulator) => {
        const installed = get().installedLiveries;

        return installed.find((entry) => {
            // Match by liveryId (preferred) or fall back to originalName for older records
            const idMatch = entry.liveryId === livery.id;
            const nameMatch = entry.originalName === livery.name;
            return (
                (idMatch || nameMatch) &&
                entry.resolution === resolution &&
                entry.simulator === simulator
            );
        });
    };

    return ({
        liveries: [],
        installedLiveries: [],
        settings: DEFAULT_SETTINGS,
        downloadStates: {},
        loading: false,
        error: null,
        initialized: false,
        downloadListenerAttached: false,

        initialize: async () => {
            if (get().initialized) return;
            await get().loadSettings();
            // Remote liveries are now fetched via TanStack Query hook (useLiveriesQuery) once a token exists.
            await get().refreshInstalled();
            get().attachDownloadListener();
            set({ initialized: true });
        },

        attachDownloadListener: () => {
            if (get().downloadListenerAttached) return;
            const api = getAPI();
            if (!api?.onDownloadProgress) return;

            api.onDownloadProgress((payload) => {
                set((state) => ({
                    downloadStates: {
                        ...state.downloadStates,
                        [payload.liveryName]: {
                            progress: payload.progress,
                            downloaded: payload.downloaded,
                            total: payload.total,
                            extracting: payload.extracting
                        }
                    }
                }));
            });

            set({ downloadListenerAttached: true });
        },

        loadSettings: async () => {
            const api = getAPI();
            if (!api?.getSettings) return;
            try {
                const persisted = await api.getSettings();
                set({ settings: { ...DEFAULT_SETTINGS, ...persisted } });
            } catch (error) {
                console.error('Failed to load settings', error);
                set({ settings: DEFAULT_SETTINGS });
            }
        },

        refreshLiveries: async () => {
            const authToken = useAuthStore.getState().token ?? null;
            if (!authToken) {
                set({ loading: false, liveries: [], error: 'Please sign in to load liveries.' });
                return;
            }

            set({ loading: true, error: null });
            const api = getAPI();

            try {
                if (api?.fetchLiveries) {
                    const payload = await api.fetchLiveries(authToken);
                    const normalized = (payload?.liveries ?? []).map((entry) => normalizeRemoteLivery(entry as unknown as Record<string, unknown>));
                    set({ liveries: normalized });
                } else {
                    const response = await fetch(REMOTE_LIVERY_LIST_URL, {
                        headers: { Authorization: `Bearer ${authToken}` }
                    });
                    if (!response.ok) {
                        const error: Error & { status?: number } = new Error(`Remote list request failed with status ${response.status}`);
                        error.status = response.status;
                        throw error;
                    }
                    const payload = await response.json();
                    const normalized = (payload?.liveries ?? []).map((entry: Record<string, unknown>) => normalizeRemoteLivery(entry));
                    set({ liveries: normalized });
                }
            } catch (error) {
                const status = (error as Error & { status?: number }).status;
                if (status === 401 || status === 403) {
                    console.warn('Livery fetch unauthorized; clearing session.');
                    useAuthStore.getState().logout();
                    set({ liveries: [], error: 'Session expired. Please sign in again.' });
                } else {
                    console.error('Failed to load liveries', error);
                    set({ liveries: [], error: 'Unable to load liveries. Please check your connection.' });
                }
            } finally {
                set({ loading: false });
            }
        },

        refreshInstalled: async () => {
            const api = getAPI();
            if (!api?.getInstalledLiveries) {
                set({ installedLiveries: [] });
                return;
            }

            try {
                const entries = await api.getInstalledLiveries();
                set({ installedLiveries: entries });
            } catch (error) {
                console.error('Failed to refresh installed liveries', error);
                set({ installedLiveries: [] });
            }
        },

        updateSettings: async (partial: Partial<Settings>) => {
            const api = getAPI();
            const next = { ...get().settings, ...partial };
            set({ settings: next });
            try {
                await api?.saveSettings?.(next);
                await get().refreshInstalled();
            } catch (error) {
                console.error('Failed to save settings', error);
                set({ error: 'Unable to save settings.' });
            }
        },

        handleDownload: async (livery, resolution, simulator) => {
            const api = getAPI();
            if (!api?.downloadLivery) {
                set({ error: 'Electron APIs are not available.' });
                return false;
            }

            const downloadRequestUrl = buildDownloadRequestUrl(livery, resolution, simulator);
            const authToken = useAuthStore.getState().token ?? null;
            if (!authToken) {
                set({ error: 'Please sign in again to download liveries.' });
                return false;
            }
            const targetSimulator = simulator === 'FS24' ? 'MSFS2024' : 'MSFS2020';

            set((state) => ({
                downloadStates: {
                    ...state.downloadStates,
                    [livery.name]: {
                        progress: 0,
                        downloaded: 0,
                        total: 0,
                        extracting: false
                    }
                }
            }));

            try {
                const result = await api.downloadLivery(downloadRequestUrl, livery.id, livery.name, targetSimulator, resolution, authToken);
                if (!result.success) {
                    throw new Error(result.error || 'Download failed');
                }

                await api.setLocalVersion?.(livery.id, livery.version ?? '1.0.0');
                await get().refreshInstalled();
                return true;
            } catch (error) {
                console.error('Download failed', error);
                set({ error: error instanceof Error ? error.message : 'Download failed' });
                return false;
            } finally {
                set((state) => {
                    const clone = { ...state.downloadStates };
                    delete clone[livery.name];
                    return { downloadStates: clone };
                });
            }
        },

        handleUninstall: async (livery, resolution, simulator) => {
            const api = getAPI();
            if (!api?.uninstallLivery) {
                set({ error: 'Electron APIs are not available.' });
                return false;
            }

            const basePath = simulator === 'FS24' ? get().settings.msfs2024Path : get().settings.msfs2020Path;
            if (!basePath) {
                set({ error: `No ${simulator === 'FS24' ? 'MSFS 2024' : 'MSFS 2020'} path configured.` });
                return false;
            }

            const installedMatch = matchInstalledEntry(livery, resolution, simulator);
            const installPath = installedMatch?.installPath ?? joinPaths(basePath, deriveInstallFolderName(livery));

            try {
                const result = await api.uninstallLivery(installPath);
                if (!result.success) {
                    throw new Error(result.error || 'Uninstall failed');
                }
                await get().refreshInstalled();
                return true;
            } catch (error) {
                console.error('Uninstall failed', error);
                set({ error: error instanceof Error ? error.message : 'Unable to uninstall livery.' });
                return false;
            }
        },

        uninstallEntry: async (entry) => {
            const api = getAPI();
            if (!api?.uninstallLivery) {
                set({ error: 'Electron APIs are not available.' });
                return false;
            }

            try {
                const result = await api.uninstallLivery(entry.installPath);
                if (!result.success) {
                    throw new Error(result.error || 'Uninstall failed');
                }
                await get().refreshInstalled();
                return true;
            } catch (error) {
                console.error('Uninstall failed', error);
                set({ error: error instanceof Error ? error.message : 'Unable to uninstall livery.' });
                return false;
            }
        },

        uninstallByPath: async (installPath) => {
            const api = getAPI();
            if (!api?.uninstallLivery) {
                set({ error: 'Electron APIs are not available.' });
                return false;
            }

            try {
                const result = await api.uninstallLivery(installPath);
                if (!result.success) {
                    throw new Error(result.error || 'Uninstall failed');
                }
                await get().refreshInstalled();
                return true;
            } catch (error) {
                console.error('Uninstall failed', error);
                set({ error: error instanceof Error ? error.message : 'Unable to uninstall livery.' });
                return false;
            }
        },

        isVariantInstalled: (livery, resolution, simulator) => {
            return Boolean(matchInstalledEntry(livery, resolution, simulator));
        },

        clearError: () => {
            set({ error: null });
        }
    });
});

export const useInitializeLiveryStore = () => {
    const initialized = useLiveryStore((state) => state.initialized);
    const token = useAuthStore((state) => state.token);
    useEffect(() => {
        if (!initialized) {
            useLiveryStore.getState().initialize().catch((error) => {
                console.error('Failed to initialize livery store', error);
            });
        }
    }, [initialized]);

    // When a fresh auth token arrives (after login), fetch liveries with proper authorization.
    useEffect(() => {
        if (initialized && token) {
            useLiveryStore
                .getState()
                .refreshLiveries()
                .catch((error) => console.error('Failed to refresh liveries after login', error));
        }
    }, [initialized, token]);
};
