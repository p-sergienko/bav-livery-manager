export interface LiveryUpdate {
    liveryId: string;
    currentVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
    changelog?: string | null;
    liveryName?: string;
    installPath?: string;
}

export interface UpdateCheckRequest {
    liveryId: string;
    currentVersion: string;
}

export interface UpdateCheckResponse {
    liveryId: string;
    hasUpdate: boolean;
    latestVersion?: string;
    currentVersion: string;
    changelog?: string | null;
}

export interface UpdatesApiResponse {
    updates: UpdateCheckResponse[];
}
