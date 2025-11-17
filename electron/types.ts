import type { BrowserWindow } from 'electron';

export interface Settings {
    msfs2020Path: string;
    msfs2024Path: string;
    defaultResolution: string;
    defaultSimulator: string;
}

export interface RemoteLivery {
    id: string;
    name: string;
    title?: string;
    tailNumber?: string | null;
    manufacturer?: string | null;
    aircraftType?: string | null;
    aircraft?: string | null;
    developer?: string | null;
    version?: string | null;
    downloadEndpoint: string;
    packageKey?: string | null;
    previewUrl?: string | null;
    simulator?: string | null;
    resolution?: string | null;
    engine?: string | null;
    year?: number | string | null;
    tags?: string[];
}

export interface RemoteLiveryPayload {
    version?: string;
    count?: number;
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
