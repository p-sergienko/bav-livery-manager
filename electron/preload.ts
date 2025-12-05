import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../src/types/electron-api';

const INVOKE_CHANNELS = [
    'fetch-liveries',
    'download-livery',
    'uninstall-livery',
    'get-settings',
    'save-settings',
    'open-directory-dialog',
    'get-file-size',
    'get-liveries-folders',
    'path-exists',
    'get-local-version',
    'set-local-version',
    'get-installed-liveries',
    'detect-sim-paths',
    'auth-open-panel'
] as const;

const ON_CHANNELS = ['download-progress', 'auth-token'] as const;

type InvokeChannel = typeof INVOKE_CHANNELS[number];
type OnChannel = typeof ON_CHANNELS[number];

function ensureInvokeChannel(channel: InvokeChannel) {
    if (!INVOKE_CHANNELS.includes(channel)) {
        throw new Error(`Invalid invoke channel: ${channel}`);
    }
}

function ensureOnChannel(channel: OnChannel) {
    if (!ON_CHANNELS.includes(channel)) {
        throw new Error(`Invalid on channel: ${channel}`);
    }
}

const api: ElectronAPI = {
    fetchLiveries: (authToken?: string | null) => {
        ensureInvokeChannel('fetch-liveries');
        return ipcRenderer.invoke('fetch-liveries', authToken ?? null);
    },
    downloadLivery: (downloadEndpoint, liveryId, liveryName, simulator, resolution, authToken) => {
        ensureInvokeChannel('download-livery');
        return ipcRenderer.invoke('download-livery', downloadEndpoint, liveryId, liveryName, simulator, resolution, authToken ?? null);
    },
    uninstallLivery: (installPath) => {
        ensureInvokeChannel('uninstall-livery');
        return ipcRenderer.invoke('uninstall-livery', installPath);
    },
    getSettings: () => {
        ensureInvokeChannel('get-settings');
        return ipcRenderer.invoke('get-settings');
    },
    saveSettings: (settings) => {
        ensureInvokeChannel('save-settings');
        return ipcRenderer.invoke('save-settings', settings);
    },
    detectSimPaths: () => {
        ensureInvokeChannel('detect-sim-paths');
        return ipcRenderer.invoke('detect-sim-paths');
    },
    openDirectoryDialog: () => {
        ensureInvokeChannel('open-directory-dialog');
        return ipcRenderer.invoke('open-directory-dialog');
    },
    getFileSize: (url) => {
        ensureInvokeChannel('get-file-size');
        return ipcRenderer.invoke('get-file-size', url);
    },
    getLiveriesFolders: (basePath) => {
        ensureInvokeChannel('get-liveries-folders');
        return ipcRenderer.invoke('get-liveries-folders', basePath);
    },
    pathExists: (targetPath) => {
        ensureInvokeChannel('path-exists');
        return ipcRenderer.invoke('path-exists', targetPath);
    },
    getLocalVersion: (liveryId) => {
        ensureInvokeChannel('get-local-version');
        return ipcRenderer.invoke('get-local-version', liveryId);
    },
    setLocalVersion: (liveryId, version) => {
        ensureInvokeChannel('set-local-version');
        return ipcRenderer.invoke('set-local-version', liveryId, version);
    },
    getInstalledLiveries: () => {
        ensureInvokeChannel('get-installed-liveries');
        return ipcRenderer.invoke('get-installed-liveries');
    },
    openPanelAuth: (url) => {
        ensureInvokeChannel('auth-open-panel');
        return ipcRenderer.invoke('auth-open-panel', url);
    },
    onDownloadProgress: (callback) => {
        ensureOnChannel('download-progress');
        ipcRenderer.removeAllListeners('download-progress');

        if (callback && typeof callback === 'function') {
            ipcRenderer.on('download-progress', (_event, data) => {
                callback(data);
            });
        }
    },
    removeAllDownloadProgressListeners: () => {
        ipcRenderer.removeAllListeners('download-progress');
    },
    onAuthToken: (callback) => {
        ensureOnChannel('auth-token');
        ipcRenderer.removeAllListeners('auth-token');

        if (callback && typeof callback === 'function') {
            ipcRenderer.on('auth-token', (_event, payload) => {
                callback(payload);
            });
        }
    }
};

contextBridge.exposeInMainWorld('electronAPI', api);

console.log('Preload script loaded successfully');

process.once('loaded', () => {
    console.log('Preload script initialized');
});
