import { app, BrowserWindow, Menu, ipcMain, shell, nativeImage, type NativeImage } from 'electron';
import path from 'node:path';
import { URL } from 'node:url';
import fs from 'fs-extra';
import { autoUpdater } from 'electron-updater';
import type { ProgressInfo, UpdateInfo } from 'electron-updater';
import log from 'electron-log';
import { registerIpcHandlers } from './ipc/registerHandlers';
import type { AppContext } from './types';

const APP_TITLE = 'BAV Livery Manager';
const AUTH_PROTOCOL = 'bav-livery-manager';
const ICON_BASENAME = 'BAV-Livery-Manager';
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let mainWindow: BrowserWindow | null = null;
let pendingAuthPayload: {
    token: string;
    role?: string | null;
    bawId?: string | null;
    pilotId?: string | null;
    fullName?: string | null;
    rank?: string | null;
    totalTime?: string | null;
} | null = null;
const isDev = process.env.NODE_ENV === 'development';
app.setName(APP_TITLE);

const appContext: AppContext = {
    getMainWindow: () => mainWindow
};

function setupAutoUpdates() {
    if (!app.isPackaged) {
        console.log('Auto updates are disabled in development mode.');
        return;
    }

    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    const sendUpdateEvent = (channel: string, data?: any) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, data);
        }
    };

    const resetProgress = () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setProgressBar(-1);
        }
    };

    autoUpdater.on('error', (error: Error) => {
        log.error('Auto update error:', error);
        resetProgress();
        sendUpdateEvent('update-error', error.message);
    });

    autoUpdater.on('checking-for-update', () => {
        log.info('Checking for application updates...');
        sendUpdateEvent('update-checking');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
        log.info('Update available:', info.version);
        sendUpdateEvent('update-available', {
            version: info.version,
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes
        });
    });

    autoUpdater.on('update-not-available', () => {
        log.info('No updates available.');
        resetProgress();
        sendUpdateEvent('update-not-available');
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
        log.info(`Download progress: ${progress.percent}%`);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setProgressBar(progress.percent / 100, { mode: 'normal' });
        }
        sendUpdateEvent('update-progress', {
            percent: progress.percent,
            bytesPerSecond: progress.bytesPerSecond,
            total: progress.total,
            transferred: progress.transferred
        });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
        log.info('Update downloaded, ready to install.', info.version);
        resetProgress();
        sendUpdateEvent('update-downloaded', {
            version: info.version,
            releaseDate: info.releaseDate,
            releaseNotes: info.releaseNotes
        });
    });

    const checkForUpdates = () => {
        autoUpdater
            .checkForUpdatesAndNotify()
            .catch((error: Error) => log.error('Failed to check for updates:', error));
    };

    checkForUpdates();
    setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
}

function getRendererPath(): string {
    const distPath = path.resolve(__dirname, '..', '..', 'dist', 'index.html');
    if (fs.existsSync(distPath)) {
        return distPath;
    }
    return path.resolve(__dirname, '..', '..', 'index.html');
}

function getPublicAssetPath(assetRelativePath: string): string {
    const basePath = app.isPackaged
        ? path.join(process.resourcesPath, 'public')
        : path.resolve(__dirname, '..', '..', 'public');
    return path.join(basePath, assetRelativePath.replace(/^[/\\]/, ''));
}

function loadNativeImageFrom(assetPath: string): NativeImage | undefined {
    try {
        if (fs.existsSync(assetPath)) {
            const image = nativeImage.createFromPath(assetPath);
            if (!image.isEmpty()) {
                return image;
            }
        }
    } catch (error) {
        console.warn(`Failed to load icon at ${assetPath}:`, error);
    }

    return undefined;
}

function resolveIconAssets(): { browserIcon?: string | NativeImage; dockIcon?: NativeImage } {
    const pngPath = getPublicAssetPath(`${ICON_BASENAME}.png`);
    const icoPath = getPublicAssetPath(`${ICON_BASENAME}.ico`);

    const pngImage = loadNativeImageFrom(pngPath);
    const icoExists = fs.existsSync(icoPath);
    const icoImage = icoExists ? loadNativeImageFrom(icoPath) : undefined;

    const browserIcon = process.platform === 'win32'
        ? (icoExists ? icoPath : pngImage)
        : (pngImage ?? icoImage);

    if (!browserIcon) {
        console.warn('No icon assets were found. Ensure public/BAV-Livery-Manager.(png|ico) exists.');
    }

    const dockIcon = pngImage ?? icoImage;

    if (!pngImage) {
        console.warn(`PNG icon missing at ${pngPath}; dock icon will fall back to ICO if available.`);
    }

    if (process.platform === 'win32' && !icoExists) {
        console.warn(`ICO icon missing at ${icoPath}; Windows build falls back to PNG.`);
    }

    return { browserIcon, dockIcon };
}

function createWindow() {
    const { browserIcon, dockIcon } = resolveIconAssets();

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1400,
        minHeight: 850,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false
        },
        show: false,
        title: APP_TITLE,
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        icon: browserIcon
    });

    if (process.platform === 'darwin' && dockIcon) {
        app.dock?.setIcon(dockIcon);
    }

    const rendererEntry = getRendererPath();

    if (isDev && process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        mainWindow.loadFile(rendererEntry);
    }

    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    mainWindow.webContents.on('did-finish-load', () => {
        if (pendingAuthPayload) {
            mainWindow?.webContents.send('auth-token', pendingAuthPayload);
            pendingAuthPayload = null;
        }
    });

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.setTitle(APP_TITLE);
}

function extractDeepLink(args: string[]): string | null {
    const target = args.find((arg) => arg.startsWith(`${AUTH_PROTOCOL}://`));
    return target ?? null;
}

function parseAuthPayload(rawUrl: string) {
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== `${AUTH_PROTOCOL}:`) {
            return null;
        }

        const token = parsed.searchParams.get('token');
        if (!token) {
            return null;
        }

        return {
            token,
            role: parsed.searchParams.get('role'),
            bawId: parsed.searchParams.get('bawId'),
            pilotId: parsed.searchParams.get('pilotId'),
            fullName: parsed.searchParams.get('fullName'),
            rank: parsed.searchParams.get('rank'),
            totalTime: parsed.searchParams.get('totalTime')
        };
    } catch {
        return null;
    }
}

function forwardAuthPayload(rawUrl: string) {
    const payload = parseAuthPayload(rawUrl);
    if (!payload) {
        return;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auth-token', payload);
    } else {
        pendingAuthPayload = payload;
    }
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', (_event, argv) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }
            mainWindow.focus();
        }

        const deepLink = extractDeepLink(argv);
        if (deepLink) {
            forwardAuthPayload(deepLink);
        }
    });
}

app.whenReady().then(() => {
    console.log('App ready, creating window...');

    setupAutoUpdates();

    createWindow();
    registerIpcHandlers(appContext);

    const initialLink = process.platform === 'win32' ? extractDeepLink(process.argv) : null;
    if (initialLink) {
        forwardAuthPayload(initialLink);
    }

    if (process.platform === 'darwin') {
        app.on('open-url', (event, url) => {
            event.preventDefault();
            forwardAuthPayload(url);
        });
    }

    if (process.defaultApp) {
        if (process.argv.length >= 2) {
            app.setAsDefaultProtocolClient(AUTH_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
        }
    } else {
        app.setAsDefaultProtocolClient(AUTH_PROTOCOL);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        console.log('Activating app, creating new window...');
        createWindow();
    }
});

app.on('before-quit', () => {
    console.log('Application shutting down...');
});

ipcMain.handle('auth-open-panel', async (_event, targetUrl: string) => {
    if (!targetUrl) {
        return;
    }

    try {
        await shell.openExternal(targetUrl);
    } catch (error) {
        console.error('Failed to open panel auth URL:', error);
    }
});

// Allow renderer to request opening arbitrary external links in the system browser
ipcMain.handle('open-external', async (_event, targetUrl: string) => {
    if (!targetUrl) return;

    try {
        await shell.openExternal(targetUrl, { activate: true });
    } catch (error) {
        console.error('Failed to open external URL:', error);
    }
});

ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
});

ipcMain.handle('check-for-updates', async () => {
    return await autoUpdater.checkForUpdates();
});

ipcMain.handle('restart-and-update', () => {
    autoUpdater.quitAndInstall(true, true);
});
