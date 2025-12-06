import type { Settings } from './livery';

interface DownloadProgressEvent {
    liveryName: string;
    progress: number;
    downloaded?: number;
    total?: number;
    extracting?: boolean;
}

interface DownloadResult {
    success: boolean;
    path?: string;
    error?: string;
    details?: string;
}

interface DetectedSimPaths {
    msfs2020Path: string | null;
    msfs2024Path: string | null;
}

export interface AuthTokenPayload {
    token: string;
    role?: string | null;
    bawId?: string | null;
    pilotId?: string | null;
    fullName?: string | null;
    rank?: string | null;
    totalTime?: string | null;
    totalFlights?: number | null;
}

/** Record of an installed livery from the local store */
export interface InstalledLiveryRecord {
    liveryId: string;
    originalName: string;
    folderName: string;
    installPath: string;
    resolution: string;
    simulator: string;
    installDate: string;
    version?: string;
}

export interface ElectronAPI {
    fetchLiveries: (authToken?: string | null) => Promise<{ version?: string; liveries: Livery[] }>;
    downloadLivery: (
        downloadEndpoint: string,
        liveryId: string,
        liveryName: string,
        simulator: 'MSFS2020' | 'MSFS2024',
        resolution: string,
        authToken?: string | null
    ) => Promise<DownloadResult>;
    uninstallLivery: (installPath: string) => Promise<{ success: boolean; error?: string }>;
    getSettings: () => Promise<Settings>;
    saveSettings: (settings: Settings) => Promise<boolean>;
    detectSimPaths: () => Promise<DetectedSimPaths | null>;
    openDirectoryDialog: () => Promise<string | null>;
    getFileSize: (url: string) => Promise<string>;
    getLiveriesFolders: (path: string) => Promise<string[]>;
    pathExists: (path: string) => Promise<boolean>;
    getLocalVersion: (liveryId: string) => Promise<string | null>;
    setLocalVersion: (liveryId: string, version: string) => Promise<boolean>;
    getInstalledLiveries: () => Promise<InstalledLiveryRecord[]>;
    setTaskbarProgress: (progress: number, mode?: 'normal' | 'indeterminate' | 'paused' | 'error' | 'none') => Promise<void>;
    setWindowTitle: (title: string) => Promise<void>;
    onDownloadProgress: (callback: ((event: DownloadProgressEvent) => void) | null) => void;
    removeAllDownloadProgressListeners: () => void;
    openPanelAuth: (url: string) => Promise<void>;
    openExternalLink: (url: string) => Promise<void>;
    onAuthToken: (callback: ((payload: AuthTokenPayload) => void) | null) => void;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

export { };
