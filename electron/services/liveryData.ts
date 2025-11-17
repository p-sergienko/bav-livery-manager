import path from 'node:path';
import fs from 'fs-extra';
import { REMOTE_LIVERY_LIST_URL } from '../../shared/constants';
import type { RemoteLivery, RemoteLiveryPayload } from '../types';
import { fetchJson } from '../utils/network';

export async function fetchRemoteLiveryList(authToken?: string | null): Promise<RemoteLiveryPayload> {
    const headers: HeadersInit = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    return fetchJson<RemoteLiveryPayload>(REMOTE_LIVERY_LIST_URL, { headers });
}

export async function fetchLiveriesForManifest(authToken?: string | null): Promise<RemoteLiveryPayload | null> {
    try {
        return await fetchRemoteLiveryList(authToken);
    } catch (error) {
        console.error('Failed to fetch liveries for manifest creation:', error);
        return null;
    }
}

export async function createManifestFile(extractPath: string, livery: RemoteLivery, resolution: string, simulator: string) {
    const manifestPath = path.join(extractPath, 'manifest.json');

    const manifest = {
        dependencies: [],
        content_type: 'LIVERY',
        title: livery.title || livery.name || 'Unknown Livery',
        manufacturer: livery.manufacturer || livery.aircraftType || 'Unknown',
        creator: livery.developer || 'Unknown',
        package_version: livery.version || '1.0.0',
        resolution,
        minimum_game_version: '1.4.20',
        minimum_compatibility_version: '4.20.0.73',
        builder: simulator === 'FS24' ? 'Microsoft Flight Simulator 2024' : 'Microsoft Flight Simulator 2020',
        release_notes: {
            neutral: {
                LastUpdate: new Date().toISOString(),
                OlderHistory: ''
            }
        },
        total_package_size: '00000000000000000000',
        livery_manager_metadata: {
            original_name: livery.name,
            install_date: new Date().toISOString(),
            source_url: livery.downloadEndpoint || '',
            resolution,
            simulator
        }
    };

    await fs.writeJson(manifestPath, manifest, { spaces: 2 });
}

export async function readManifestFile(liveryPath: string) {
    try {
        const manifestPath = path.join(liveryPath, 'manifest.json');
        if (await fs.pathExists(manifestPath)) {
            return fs.readJson(manifestPath);
        }
        return null;
    } catch (error) {
        console.error('Error reading manifest file:', error);
        return null;
    }
}
