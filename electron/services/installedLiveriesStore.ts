import path from 'node:path';
import { app } from 'electron';
import fs from 'fs-extra';

export interface InstalledLiveryRecord {
    /** The unique livery ID from the remote catalog */
    liveryId: string;
    /** The livery name from the remote catalog */
    originalName: string;
    /** The folder name where the livery is installed */
    folderName: string;
    /** Full path to the installed livery folder */
    installPath: string;
    /** Resolution variant (4K, 8K) */
    resolution: string;
    /** Target simulator (FS20, FS24) */
    simulator: string;
    /** ISO date string of when it was installed */
    installDate: string;
    /** Version at time of install */
    version?: string;
}

interface InstalledLiveriesData {
    version: number;
    liveries: InstalledLiveryRecord[];
}

const DATA_VERSION = 1;
let storeFilePath: string | null = null;
let cachedData: InstalledLiveriesData | null = null;

function getStorePath(): string {
    if (!storeFilePath) {
        storeFilePath = path.join(app.getPath('userData'), 'installed-liveries.json');
    }
    return storeFilePath;
}

async function loadData(): Promise<InstalledLiveriesData> {
    if (cachedData) return cachedData;

    const filePath = getStorePath();
    try {
        if (await fs.pathExists(filePath)) {
            const data = await fs.readJson(filePath);
            cachedData = {
                version: data.version ?? DATA_VERSION,
                liveries: Array.isArray(data.liveries) ? data.liveries : []
            };
        } else {
            cachedData = { version: DATA_VERSION, liveries: [] };
        }
    } catch (error) {
        console.error('Failed to load installed liveries data:', error);
        cachedData = { version: DATA_VERSION, liveries: [] };
    }
    return cachedData;
}

async function saveData(data: InstalledLiveriesData): Promise<void> {
    const filePath = getStorePath();
    try {
        await fs.writeJson(filePath, data, { spaces: 2 });
        cachedData = data;
    } catch (error) {
        console.error('Failed to save installed liveries data:', error);
    }
}

export async function recordInstallation(record: Omit<InstalledLiveryRecord, 'installDate'>): Promise<void> {
    const data = await loadData();
    
    // Remove any existing record for the same livery+resolution+simulator combo
    data.liveries = data.liveries.filter(
        (entry) => !(
            entry.originalName === record.originalName &&
            entry.resolution === record.resolution &&
            entry.simulator === record.simulator
        )
    );
    
    // Add the new record
    data.liveries.push({
        ...record,
        installDate: new Date().toISOString()
    });
    
    await saveData(data);
    console.log('Recorded installation:', record.originalName, record.resolution, record.simulator);
}

export async function removeInstallation(originalName: string, resolution: string, simulator: string): Promise<void> {
    const data = await loadData();
    
    const initialLength = data.liveries.length;
    data.liveries = data.liveries.filter(
        (entry) => !(
            entry.originalName === originalName &&
            entry.resolution === resolution &&
            entry.simulator === simulator
        )
    );
    
    if (data.liveries.length !== initialLength) {
        await saveData(data);
        console.log('Removed installation record:', originalName, resolution, simulator);
    }
}

export async function removeInstallationByPath(installPath: string): Promise<InstalledLiveryRecord | null> {
    const data = await loadData();
    
    const normalizedPath = path.normalize(installPath).toLowerCase();
    const record = data.liveries.find(
        (entry) => path.normalize(entry.installPath).toLowerCase() === normalizedPath
    );
    
    if (record) {
        data.liveries = data.liveries.filter((entry) => entry !== record);
        await saveData(data);
        console.log('Removed installation record by path:', installPath);
    }
    
    return record ?? null;
}

export async function getInstalledLiveries(): Promise<InstalledLiveryRecord[]> {
    const data = await loadData();
    return data.liveries;
}

export async function getInstalledLiveriesForSimulator(simulator: string): Promise<InstalledLiveryRecord[]> {
    const data = await loadData();
    return data.liveries.filter((entry) => entry.simulator === simulator);
}

export async function isInstalled(originalName: string, resolution: string, simulator: string): Promise<boolean> {
    const data = await loadData();
    return data.liveries.some(
        (entry) =>
            entry.originalName === originalName &&
            entry.resolution === resolution &&
            entry.simulator === simulator
    );
}

export async function getInstallationRecord(
    originalName: string,
    resolution: string,
    simulator: string
): Promise<InstalledLiveryRecord | null> {
    const data = await loadData();
    return data.liveries.find(
        (entry) =>
            entry.originalName === originalName &&
            entry.resolution === resolution &&
            entry.simulator === simulator
    ) ?? null;
}

/** Validate that recorded installations still exist on disk */
export async function validateInstallations(): Promise<void> {
    const data = await loadData();
    const validLiveries: InstalledLiveryRecord[] = [];
    
    for (const entry of data.liveries) {
        if (await fs.pathExists(entry.installPath)) {
            validLiveries.push(entry);
        } else {
            console.log('Removing stale installation record (folder not found):', entry.installPath);
        }
    }
    
    if (validLiveries.length !== data.liveries.length) {
        data.liveries = validLiveries;
        await saveData(data);
    }
}
