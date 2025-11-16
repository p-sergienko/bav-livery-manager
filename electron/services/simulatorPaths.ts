import path from 'node:path';
import fs from 'fs-extra';
import { app } from 'electron';
import type { DetectedSimPaths } from '../types';

const USER_CFG_FILE = 'UserCfg.opt';
const COMMUNITY_FOLDER = 'Community';

type ElectronPathKey = 'appData' | 'localAppData';

const PATH_ENV_FALLBACKS: Partial<Record<ElectronPathKey, string[]>> = {
    appData: ['APPDATA'],
    localAppData: ['LOCALAPPDATA']
};

const missingPathWarnings = new Set<ElectronPathKey>();

function safeGetPath(key: ElectronPathKey): string | null {
    if (process.platform !== 'win32') {
        return null;
    }

    if (key === 'localAppData') {
        const envKeys = PATH_ENV_FALLBACKS[key] || [];
        for (const envKey of envKeys) {
            const envPath = process.env[envKey];
            if (envPath) {
                return envPath;
            }
        }

        if (!missingPathWarnings.has(key)) {
            missingPathWarnings.add(key);
            console.warn(`Unable to resolve environment path for ${key}`);
        }
        return null;
    }

    try {
        return app.getPath(key);
    } catch (error) {
        const envKeys = PATH_ENV_FALLBACKS[key] || [];
        for (const envKey of envKeys) {
            const envPath = process.env[envKey];
            if (envPath) {
                return envPath;
            }
        }

        if (!missingPathWarnings.has(key)) {
            missingPathWarnings.add(key);
            console.warn(`Unable to resolve Electron path for ${key}: ${(error as Error).message}`);
        }
        return null;
    }
}

const USER_CFG_LOCATIONS = {
    MSFS2020: () => {
        const locations: string[] = [];
        const appData = safeGetPath('appData');
        const localAppData = safeGetPath('localAppData');
        if (appData) {
            locations.push(path.join(appData, 'Microsoft Flight Simulator', USER_CFG_FILE));
        }
        if (localAppData) {
            locations.push(path.join(localAppData, 'Packages', 'Microsoft.FlightSimulator_8wekyb3d8bbwe', 'LocalCache', USER_CFG_FILE));
        }
        return locations;
    },
    MSFS2024: () => {
        const locations: string[] = [];
        const appData = safeGetPath('appData');
        const localAppData = safeGetPath('localAppData');
        if (appData) {
            locations.push(path.join(appData, 'Microsoft Flight Simulator 2024', USER_CFG_FILE));
        }
        if (localAppData) {
            locations.push(path.join(localAppData, 'Packages', 'Microsoft.Limitless_8wekyb3d8bbwe', 'LocalCache', USER_CFG_FILE));
        }
        return locations;
    }
};

async function resolveCommunityFolder(candidatePaths: string[]): Promise<string | null> {
    for (const cfgPath of candidatePaths) {
        try {
            if (!(await fs.pathExists(cfgPath))) {
                continue;
            }

            const contents = await fs.readFile(cfgPath, 'utf8');
            const match = contents.match(/InstalledPackagesPath\s+"([^"]+)"/i);
            if (match && match[1]) {
                const packagesPath = match[1].trim();
                const normalized = path.normalize(packagesPath);
                const communityPath = path.join(normalized, COMMUNITY_FOLDER);
                if (await fs.pathExists(communityPath)) {
                    return communityPath;
                }
                return normalized;
            }
        } catch (error) {
            console.warn(`Failed to inspect ${cfgPath}:`, (error as Error).message);
            continue;
        }
    }
    return null;
}

export async function detectSimulatorPaths(): Promise<DetectedSimPaths> {
    if (process.platform !== 'win32') {
        return {
            msfs2020Path: null,
            msfs2024Path: null
        };
    }

    if (!app.isReady()) {
        await app.whenReady();
    }

    const [msfs2020Path, msfs2024Path] = await Promise.all([
        resolveCommunityFolder(USER_CFG_LOCATIONS.MSFS2020()),
        resolveCommunityFolder(USER_CFG_LOCATIONS.MSFS2024())
    ]);

    return {
        msfs2020Path,
        msfs2024Path
    };
}
