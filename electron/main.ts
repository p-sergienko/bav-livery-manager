import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import fs from 'fs-extra';
import { registerIpcHandlers } from './ipc/registerHandlers';
import type { AppContext } from './types';

const APP_TITLE = 'BAV Livery Manager';

let mainWindow: BrowserWindow | null = null;
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

function createWindow() {
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
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
    });

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

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.setTitle(APP_TITLE);
}

app.whenReady().then(() => {
    console.log('App ready, creating window...');
    createWindow();
    registerIpcHandlers(appContext);
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
