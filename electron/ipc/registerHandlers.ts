import path from 'node:path';
import fs from 'fs-extra';
import { dialog, ipcMain } from 'electron';
import type { OpenDialogOptions } from 'electron';
import type { AppContext, DownloadResult, Settings } from '../types';
import { detectSimulatorPaths } from '../services/simulatorPaths';
import { fetchLiveriesForManifest, fetchRemoteLiveryList, readManifestFile } from '../services/liveryData';
import { downloadAndInstallLivery } from '../services/downloadManager';
import { loadSettings, saveSettings } from '../services/settingsStore';
import { fetchWithTimeout } from '../utils/network';
import * as versionManager from '../versionManager';

let handlersRegistered = false;

export function registerIpcHandlers(appContext: AppContext) {
    if (handlersRegistered) {
        return;
    }

    ipcMain.handle('get-file-size', async (_event, url: string) => {
        try {
            const response = await fetchWithTimeout(url, { method: 'HEAD' }, 5000);
            const contentLength = response.headers.get('content-length');
            if (contentLength) {
                const sizeInBytes = parseInt(contentLength, 10);
                return formatFileSize(sizeInBytes);
            }
            return 'Unknown';
        } catch (error) {
            console.error('Error getting file size:', error);
            return 'Unknown';
        }
    });

    ipcMain.handle('fetch-liveries', async () => {
        console.log('Fetching liveries from remote server...');
        return fetchRemoteLiveryList();
    });

    ipcMain.handle('download-livery', async (_event, downloadUrl: string, liveryName: string, simulator: 'MSFS2020' | 'MSFS2024', resolution: string): Promise<DownloadResult> => {
        const settings = loadSettings();
        return downloadAndInstallLivery({
            downloadUrl,
            liveryName,
            simulator,
            resolution,
            settings,
            appContext,
            fetchManifestData: fetchLiveriesForManifest
        });
    });

    ipcMain.handle('read-manifest', async (_event, liveryPath: string) => {
        return readManifestFile(liveryPath);
    });

    ipcMain.handle('detect-sim-paths', async () => {
        return detectSimulatorPaths();
    });

    ipcMain.handle('uninstall-livery', async (_event, liveryPath: string) => {
        try {
            console.log('Uninstalling livery from:', liveryPath);

            if (await fs.pathExists(liveryPath)) {
                await fs.remove(liveryPath);
                console.log('Successfully uninstalled livery');
                return { success: true };
            }
            return { success: false, error: 'Path does not exist' };
        } catch (error) {
            console.error('Uninstall error:', error);
            return { success: false, error: (error as Error).message };
        }
    });

    ipcMain.handle('get-settings', () => loadSettings());
    ipcMain.handle('save-settings', (_event, settings: Settings) => saveSettings(settings));

    ipcMain.handle('open-directory-dialog', async () => {
        const options: OpenDialogOptions = {
            properties: ['openDirectory'],
            title: 'Select MSFS Community Folder'
        };

        const targetWindow = appContext.getMainWindow();
        const result = targetWindow ? await dialog.showOpenDialog(targetWindow, options) : await dialog.showOpenDialog(options);
        return result.filePaths[0] || null;
    });

    ipcMain.handle('get-liveries-folders', async (_event, basePath: string) => {
        try {
            if (!(await fs.pathExists(basePath))) return [];

            const items = await fs.readdir(basePath);
            const folders: string[] = [];

            for (const item of items) {
                if (item.startsWith('orbx-') || item.startsWith('asobo-') || item === 'Official' || item === 'OneStore') {
                    continue;
                }

                const itemPath = path.join(basePath, item);
                try {
                    const stat = await fs.stat(itemPath);
                    if (stat.isDirectory()) {
                        folders.push(item);
                    }
                } catch {
                    console.log(`Skipping inaccessible folder: ${item}`);
                    continue;
                }
            }

            return folders;
        } catch (error) {
            console.error('Error reading liveries folders:', error);
            return [];
        }
    });

    ipcMain.handle('path-exists', async (_event, targetPath: string) => fs.pathExists(targetPath));

    ipcMain.handle('get-local-version', (_event, liveryId: string) => versionManager.getLocalVersion(liveryId));
    ipcMain.handle('set-local-version', (_event, liveryId: string, version: string) => versionManager.setLocalVersion(liveryId, version));

    ipcMain.handle('get-installed-liveries', async (_event, basePath: string) => {
        try {
            if (!(await fs.pathExists(basePath))) return [];

            const folders = await fs.readdir(basePath);
            const installedLiveries: Array<{ name: string; path: string; installedDate: Date; manifest: unknown }> = [];

            for (const folder of folders) {
                if (folder.startsWith('orbx-') || folder.startsWith('asobo-')) {
                    continue;
                }

                const folderPath = path.join(basePath, folder);

                try {
                    const stat = await fs.stat(folderPath);
                    if (!stat.isDirectory()) {
                        continue;
                    }

                    const manifest = await readManifestFile(folderPath);
                    installedLiveries.push({
                        name: folder,
                        path: folderPath,
                        installedDate: stat.birthtime,
                        manifest
                    });
                } catch {
                    continue;
                }
            }

            return installedLiveries;
        } catch (error) {
            console.error('Error getting installed liveries:', error);
            return [];
        }
    });

    handlersRegistered = true;
}

function formatFileSize(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
