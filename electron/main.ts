import { app, BrowserWindow, Menu, ipcMain, shell, nativeImage, type NativeImage } from 'electron';
import path from 'node:path';
import { URL } from 'node:url';
import fs from 'fs-extra';
import { updateElectronApp } from 'update-electron-app';
import { registerIpcHandlers } from './ipc/registerHandlers';
import type { AppContext } from './types';

const APP_TITLE = 'BAV Livery Manager';
const AUTH_PROTOCOL = 'bav-livery-manager';
const ICON_BASENAME = 'BAV-Livery-Manager';

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
    
    // Initialize auto-updater (only in production)
    if (!isDev) {
        updateElectronApp({
            updateInterval: '1 hour',
            logger: console,
            notifyUser: true
        });
    }
    
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
