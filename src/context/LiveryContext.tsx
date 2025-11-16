import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type {
    DownloadProgress,
    InstalledLivery,
    Livery,
    Resolution,
    Settings,
    Simulator
} from '@/types/livery';
import { getDownloadUrlForSelection, getFolderNameFromUrl, joinPaths } from '@/utils/livery';
import { REMOTE_LIVERY_LIST_URL } from '@shared/constants';

const DEFAULT_SETTINGS: Settings = {
    msfs2020Path: '',
    msfs2024Path: '',
    defaultResolution: '4K',
    defaultSimulator: 'FS20'
};

interface LiveryContextValue {
    liveries: Livery[];
    loading: boolean;
    error: string | null;
    settings: Settings;
    installedLiveries: InstalledLivery[];
    downloadStates: Record<string, DownloadProgress>;
    refreshLiveries: () => Promise<void>;
    refreshInstalled: () => Promise<void>;
    updateSettings: (partial: Partial<Settings>) => Promise<void>;
    handleDownload: (livery: Livery, resolution: Resolution, simulator: Simulator) => Promise<boolean>;
    handleUninstall: (livery: Livery, resolution: Resolution, simulator: Simulator) => Promise<boolean>;
    uninstallEntry: (entry: InstalledLivery) => Promise<boolean>;
    isVariantInstalled: (livery: Livery, resolution: Resolution, simulator: Simulator) => boolean;
}

const defaultContext: LiveryContextValue = {
    liveries: [],
    loading: false,
    error: null,
    settings: DEFAULT_SETTINGS,
    installedLiveries: [],
    downloadStates: {},
    refreshLiveries: async () => undefined,
    refreshInstalled: async () => undefined,
    updateSettings: async () => undefined,
    handleDownload: async () => false,
    handleUninstall: async () => false,
    uninstallEntry: async () => false,
    isVariantInstalled: () => false
};

const LiveryContext = createContext<LiveryContextValue>(defaultContext);

export const LiveryProvider = ({ children }: PropsWithChildren) => {
    const [liveries, setLiveries] = useState<Livery[]>([]);
    const [installedLiveries, setInstalledLiveries] = useState<InstalledLivery[]>([]);
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [downloadStates, setDownloadStates] = useState<Record<string, DownloadProgress>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;

    const refreshLiveries = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (electronAPI?.fetchLiveries) {
                const payload = await electronAPI.fetchLiveries();
                setLiveries(payload.liveries || []);
            } else {
                const response = await fetch(REMOTE_LIVERY_LIST_URL);
                if (!response.ok) {
                    throw new Error(`Remote list request failed with status ${response.status}`);
                }
                const payload = await response.json();
                setLiveries(payload.liveries || []);
            }
        } catch (err) {
            console.error('Failed to load liveries', err);
            setError('Unable to load liveries. Please check your connection.');
            setLiveries([]);
        } finally {
            setLoading(false);
        }
    }, [electronAPI]);

    const refreshInstalled = useCallback(async () => {
        if (!electronAPI?.getInstalledLiveries) {
            setInstalledLiveries([]);
            return;
        }

        const paths: Array<{ path: string; simulator: Simulator }> = [];
        if (settings.msfs2020Path) {
            paths.push({ path: settings.msfs2020Path, simulator: 'FS20' });
        }
        if (settings.msfs2024Path) {
            paths.push({ path: settings.msfs2024Path, simulator: 'FS24' });
        }

        if (!paths.length) {
            setInstalledLiveries([]);
            return;
        }

        try {
            const collections = await Promise.all(
                paths.map(async ({ path, simulator }) => {
                    try {
                        const entries = await electronAPI.getInstalledLiveries(path);
                        return entries.map((entry) => ({ ...entry, simulatorHint: simulator }));
                    } catch (innerError) {
                        console.error(`Failed to read installed liveries from ${path}`, innerError);
                        return [];
                    }
                })
            );

            setInstalledLiveries(collections.flat());
        } catch (err) {
            console.error('Failed to refresh installed liveries', err);
            setInstalledLiveries([]);
        }
    }, [electronAPI, settings.msfs2020Path, settings.msfs2024Path]);

    const loadSettings = useCallback(async () => {
        if (!electronAPI?.getSettings) {
            return;
        }

        try {
            const persisted = await electronAPI.getSettings();
            setSettings({ ...DEFAULT_SETTINGS, ...persisted });
        } catch (err) {
            console.error('Failed to load settings', err);
        }
    }, [electronAPI]);

    useEffect(() => {
        loadSettings();
        refreshLiveries();
    }, [loadSettings, refreshLiveries]);

    useEffect(() => {
        refreshInstalled();
    }, [refreshInstalled]);

    useEffect(() => {
        if (!electronAPI?.onDownloadProgress) {
            return;
        }

        const handler = (payload: { liveryName: string; progress: number; downloaded?: number; total?: number; extracting?: boolean }) => {
            setDownloadStates((prev) => ({
                ...prev,
                [payload.liveryName]: {
                    progress: payload.progress,
                    downloaded: payload.downloaded,
                    total: payload.total,
                    extracting: payload.extracting
                }
            }));
        };

        electronAPI.onDownloadProgress(handler);

        return () => {
            electronAPI.removeAllDownloadProgressListeners?.();
        };
    }, [electronAPI]);

    const updateSettings = useCallback(
        async (partial: Partial<Settings>) => {
            const next = { ...settings, ...partial };
            setSettings(next);
            try {
                await electronAPI?.saveSettings?.(next);
                await refreshInstalled();
            } catch (err) {
                console.error('Failed to persist settings', err);
                setError('Unable to save settings.');
            }
        },
        [electronAPI, refreshInstalled, settings]
    );

    const handleDownload = useCallback(
        async (livery: Livery, resolution: Resolution, simulator: Simulator) => {
            if (!electronAPI?.downloadLivery) {
                setError('Electron APIs are not available.');
                return false;
            }

            const downloadUrl = getDownloadUrlForSelection(livery, resolution, simulator);
            const targetSimulator = simulator === 'FS24' ? 'MSFS2024' : 'MSFS2020';

            setDownloadStates((prev) => ({
                ...prev,
                [livery.name]: {
                    progress: 0,
                    downloaded: 0,
                    total: 0,
                    extracting: false
                }
            }));

            try {
                const result = await electronAPI.downloadLivery(downloadUrl, livery.name, targetSimulator, resolution);
                if (!result.success) {
                    throw new Error(result.error || 'Download failed');
                }

                await electronAPI.setLocalVersion?.(livery.name, livery.version ?? '1.0.0');
                await refreshInstalled();
                return true;
            } catch (err) {
                console.error('Download failed', err);
                setError(err instanceof Error ? err.message : 'Download failed');
                return false;
            } finally {
                setDownloadStates((prev) => {
                    const clone = { ...prev };
                    delete clone[livery.name];
                    return clone;
                });
            }
        },
        [electronAPI, refreshInstalled]
    );

    const handleUninstall = useCallback(
        async (livery: Livery, resolution: Resolution, simulator: Simulator) => {
            if (!electronAPI?.uninstallLivery) {
                setError('Electron APIs are not available.');
                return false;
            }

            const basePath = simulator === 'FS24' ? settings.msfs2024Path : settings.msfs2020Path;
            if (!basePath) {
                setError(`No ${simulator === 'FS24' ? 'MSFS 2024' : 'MSFS 2020'} path configured.`);
                return false;
            }

            const downloadUrl = getDownloadUrlForSelection(livery, resolution, simulator);
            const folderName = getFolderNameFromUrl(downloadUrl);
            const installPath = joinPaths(basePath, folderName);

            try {
                const result = await electronAPI.uninstallLivery(installPath);
                if (!result.success) {
                    throw new Error(result.error || 'Uninstall failed');
                }
                await refreshInstalled();
                return true;
            } catch (err) {
                console.error('Uninstall failed', err);
                setError(err instanceof Error ? err.message : 'Unable to uninstall livery.');
                return false;
            }
        },
        [electronAPI, refreshInstalled, settings.msfs2020Path, settings.msfs2024Path]
    );

    const uninstallEntry = useCallback(
        async (entry: InstalledLivery) => {
            if (!electronAPI?.uninstallLivery) {
                setError('Electron APIs are not available.');
                return false;
            }

            try {
                const result = await electronAPI.uninstallLivery(entry.path);
                if (!result.success) {
                    throw new Error(result.error || 'Uninstall failed');
                }
                await refreshInstalled();
                return true;
            } catch (err) {
                console.error('Uninstall failed', err);
                setError(err instanceof Error ? err.message : 'Unable to uninstall livery.');
                return false;
            }
        },
        [electronAPI, refreshInstalled]
    );

    const isVariantInstalled = useCallback(
        (livery: Livery, resolution: Resolution, simulator: Simulator) => {
            const expectedFolder = getFolderNameFromUrl(getDownloadUrlForSelection(livery, resolution, simulator));
            return installedLiveries.some((entry) => {
                const metadata = entry.manifest?.livery_manager_metadata;
                if (metadata?.original_name) {
                    return (
                        metadata.original_name === livery.name &&
                        (metadata.resolution ?? settings.defaultResolution) === resolution &&
                        (metadata.simulator ?? settings.defaultSimulator) === simulator
                    );
                }

                return entry.name === expectedFolder;
            });
        },
        [installedLiveries, settings.defaultResolution, settings.defaultSimulator]
    );

    const contextValue = useMemo<LiveryContextValue>(
        () => ({
            liveries,
            loading,
            error,
            settings,
            installedLiveries,
            downloadStates,
            refreshLiveries,
            refreshInstalled,
            updateSettings,
            handleDownload,
            handleUninstall,
            uninstallEntry,
            isVariantInstalled
        }),
        [
            downloadStates,
            error,
            handleDownload,
            handleUninstall,
            uninstallEntry,
            installedLiveries,
            isVariantInstalled,
            liveries,
            loading,
            refreshInstalled,
            refreshLiveries,
            settings,
            updateSettings
        ]
    );

    return <LiveryContext.Provider value={contextValue}>{children}</LiveryContext.Provider>;
};

export const useLiveryContext = (): LiveryContextValue => {
    const context = useContext(LiveryContext);
    if (!context) {
        throw new Error('useLiveryContext must be used inside LiveryProvider');
    }
    return context;
};
