import path from 'node:path';
import fs from 'fs-extra';
import { app } from 'electron';
import type { Settings } from '../types';

const DEFAULT_SETTINGS: Settings = {
    msfs2020Path: '',
    msfs2024Path: '',
    defaultResolution: '4K',
    defaultSimulator: 'FS20'
};

let settingsFilePath: string | null = null;

function resolveSettingsPath(): string {
    if (settingsFilePath) {
        return settingsFilePath;
    }

    try {
        settingsFilePath = path.join(app.getPath('userData'), 'settings.json');
    } catch (error) {
        console.warn('Unable to resolve userData path, falling back to local settings.json:', error);
        settingsFilePath = path.join(process.cwd(), 'settings.json');
    }

    return settingsFilePath;
}

export function loadSettings(): Settings {
    try {
        const filePath = resolveSettingsPath();
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Settings;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }

    return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Settings): boolean {
    try {
        const filePath = resolveSettingsPath();
        fs.ensureFileSync(filePath);
        fs.writeJsonSync(filePath, settings, { spaces: 2 });
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

export { DEFAULT_SETTINGS };
