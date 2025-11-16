import type { BrowserWindow } from 'electron';

export interface Settings {
    msfs2020Path: string;
    msfs2024Path: string;
    defaultResolution: string;
    defaultSimulator: string;
}

export interface RemoteLivery {
    name: string;
    manufacturer?: string;
    aircraftType?: string;
    developer?: string;
    version?: string;
    downloadUrl?: string;
}

export interface RemoteLiveryPayload {
    version?: string;
    liveries: RemoteLivery[];
}

export interface DownloadProgress {
    percent: number;
    transferred: number;
    total: number;
}

export interface DetectedSimPaths {
    msfs2020Path: string | null;
    msfs2024Path: string | null;
}

export interface AppContext {
    getMainWindow(): BrowserWindow | null;
}

export interface DownloadResult {
    success: boolean;
    path?: string;
    error?: string;
    details?: string;
}
