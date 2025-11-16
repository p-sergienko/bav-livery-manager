export type Resolution = '4K' | '8K';
export type Simulator = 'FS20' | 'FS24';

export interface Livery {
    name: string;
    developer: string;
    aircraftType: string;
    year?: string;
    engine?: string;
    resolution?: Resolution;
    size?: string;
    preview?: string;
    downloadUrl: string;
    downloadUrl4K?: string;
    downloadUrlFS24?: string;
    downloadUrl4KFS24?: string;
    simulator?: 'MSFS2020' | 'MSFS2024' | string;
    registration?: string;
    version?: string;
    manufacturer?: string;
}

export interface Settings {
    msfs2020Path: string;
    msfs2024Path: string;
    defaultResolution: Resolution;
    defaultSimulator: Simulator;
}

export interface ManifestMetadata {
    title?: string;
    creator?: string;
    version?: string;
    manufacturer?: string;
    livery_manager_metadata?: {
        original_name?: string;
        install_date?: string;
        source_url?: string;
        resolution?: Resolution;
        simulator?: Simulator;
    };
}

export interface InstalledLivery {
    name: string;
    path: string;
    installedDate: string | number | Date;
    manifest?: ManifestMetadata;
    simulatorHint?: Simulator;
}

export interface DownloadProgress {
    progress: number;
    downloaded?: number;
    total?: number;
    extracting?: boolean;
}
