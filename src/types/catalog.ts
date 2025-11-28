export interface CatalogAircraft {
    id: string;
    name: string;
    engine?: string | null;
}

export interface CatalogSimulator {
    id: string;
    code: string;
    defaultResolution?: string | null;
}

export interface CatalogResolution {
    id: string;
    value: string;
    description?: string | null;
}

export interface CatalogDeveloper {
    id: string;
    name: string;
    aircraftProfileId?: string | null;
    aircraftIds?: string[];
    defaultSimulatorId?: string | null;
    defaultResolutionId?: string | null;
}

export interface CatalogCategory {
    id: string;
    name: string;
    description?: string | null;
}

export interface CatalogResponse {
    aircraft: CatalogAircraft[];
    simulators: CatalogSimulator[];
    resolutions: CatalogResolution[];
    developers: CatalogDeveloper[];
    categories: CatalogCategory[];
}
