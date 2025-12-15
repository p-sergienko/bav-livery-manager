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
            const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Settings;

            if (parsed.msfs2020Path?.includes('Liveries')) {
                parsed.msfs2020Path = parsed.msfs2020Path.replace(/\\?Liveries$/, '');
            }
            if (parsed.msfs2024Path?.includes('Liveries')) {
                parsed.msfs2024Path = parsed.msfs2024Path.replace(/\\?Liveries$/, '');
            }

            return {
                msfs2020Path: parsed.msfs2020Path || '',
                msfs2024Path: parsed.msfs2024Path || '',
                defaultResolution: parsed.defaultResolution || DEFAULT_SETTINGS.defaultResolution,
                defaultSimulator: parsed.defaultSimulator || DEFAULT_SETTINGS.defaultSimulator
            };
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }

    return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Settings): boolean {
    try {
        console.log(settings)
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
