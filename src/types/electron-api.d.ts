import type { InstalledLivery, Livery, Settings } from './livery';

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

export interface ElectronAPI {
    fetchLiveries: () => Promise<{ version?: string; liveries: Livery[] }>;
    downloadLivery: (downloadUrl: string, liveryName: string, simulator: 'MSFS2020' | 'MSFS2024', resolution: string) => Promise<DownloadResult>;
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
    getInstalledLiveries: (path: string) => Promise<InstalledLivery[]>;
    readManifest: (path: string) => Promise<any>;
    onDownloadProgress: (callback: ((event: DownloadProgressEvent) => void) | null) => void;
    removeAllDownloadProgressListeners: () => void;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

export { };
