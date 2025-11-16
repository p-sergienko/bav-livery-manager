import path from 'node:path';
import fs from 'fs-extra';
import { app } from 'electron';

function resolveFallbackPath(): string {
    return path.join(__dirname, '..', 'localVersion.json');
}

function getVersionPath(): string {
    try {
        return path.join(app.getPath('userData'), 'localVersion.json');
    } catch (error) {
        console.warn('Falling back to local version file path:', error);
        return resolveFallbackPath();
    }
}

export function getLocalVersion(liveryId: string) {
    try {
        const versionPath = getVersionPath();
        if (fs.existsSync(versionPath)) {
            const raw = fs.readFileSync(versionPath, 'utf8');
            const data = JSON.parse(raw) as Record<string, string>;
            console.log(`Retrieved version for ${liveryId}:`, data[liveryId] || 'none');
            return data[liveryId] || null;
        }
    } catch (error) {
        console.error('Error reading version file:', error);
    }
    return null;
}

export function setLocalVersion(liveryId: string, version: string) {
    try {
        const versionPath = getVersionPath();
        let data: Record<string, string> = {};
        if (fs.existsSync(versionPath)) {
            const raw = fs.readFileSync(versionPath, 'utf8');
            data = JSON.parse(raw) as Record<string, string>;
        }
        console.log(`Setting version for ${liveryId} to ${version}`);
        data[liveryId] = version;
        fs.ensureFileSync(versionPath);
        fs.writeFileSync(versionPath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing version file:', error);
        return false;
    }
}
