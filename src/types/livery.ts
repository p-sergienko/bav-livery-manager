export type Resolution = '4K' | '8K';
export type Simulator = 'FS20' | 'FS24';

export interface Livery {
    id: string;
    name: string;
    title?: string;
    tailNumber?: string | null;
    developer: string;
    aircraftType: string;
    aircraft?: string;
    year?: string | number | null;
    engine?: string | null;
    resolution?: string | Resolution | null;
    size?: string | number | null;
    preview?: string | null;
    previewUrl?: string | null;
    downloadEndpoint: string;
    packageKey?: string | null;
    simulator?: 'MSFS2020' | 'MSFS2024' | string | null;
    registration?: string | null;
    version?: string | null;
    manufacturer?: string | null;
    tags?: string[];
    status?: string;
    categoryId?: string | null;
    categoryName?: string | null;
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
