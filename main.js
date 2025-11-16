const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { Readable } = require('node:stream');
const AdmZip = require('adm-zip');
const { spawn } = require('child_process');
const versionManager = require('./versionManager');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
let mainWindow;
let ipcHandlersSetup = false;
const isDev = process.env.NODE_ENV === 'development';
const USER_CFG_FILE = 'UserCfg.opt';
const COMMUNITY_FOLDER = 'Community';
const PATH_ENV_FALLBACKS = {
  appData: ['APPDATA'],
  localAppData: ['LOCALAPPDATA']
};
const missingPathWarnings = new Set();
const REMOTE_LIVERY_LIST_URL = 'https://pub-2238f1e492d94cc6b7dfbeed51dd902f.r2.dev/list.json';

function createRequestError(response, url) {
  const error = new Error(`Request to ${url} failed with status ${response.status}`);
  error.status = response.status;
  return error;
}

async function fetchWithTimeout(url, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, timeout = 15000) {
  const response = await fetchWithTimeout(url, {}, timeout);
  if (!response.ok) {
    throw createRequestError(response, url);
  }
  return response.json();
}

function safeGetPath(key) {
  if (process.platform !== 'win32') {
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
      console.warn(`Unable to resolve Electron path for ${key}: ${error.message}`);
    }
    return null;
  }
}

const USER_CFG_LOCATIONS = {
  MSFS2020: () => {
    const locations = [];
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
    const locations = [];
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

async function resolveCommunityFolder(candidatePaths) {
  for (const cfgPath of candidatePaths) {
    try {
      if (!await fs.pathExists(cfgPath)) {
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
      console.warn(`Failed to inspect ${cfgPath}:`, error.message);
      continue;
    }
  }
  return null;
}

async function detectSimulatorPaths() {
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

function getRendererPath() {
  const distPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(distPath)) {
    return distPath;
  }
  return path.join(__dirname, 'index.html');
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
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false
    },
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
  });

  const rendererEntry = getRendererPath();

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(rendererEntry);
  }

  // Remove default menu bar (File/Edit/View...)
  Menu.setApplicationMenu(null);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

/* SETTINGS HANDLING */
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));

      if (settings.msfs2020Path && settings.msfs2020Path.includes('Liveries')) {
        settings.msfs2020Path = settings.msfs2020Path.replace(/\\?Liveries$/, '');
      }
      if (settings.msfs2024Path && settings.msfs2024Path.includes('Liveries')) {
        settings.msfs2024Path = settings.msfs2024Path.replace(/\\?Liveries$/, '');
      }

      // FIX: Ensure we always return valid defaults
      return {
        msfs2020Path: settings.msfs2020Path || '',
        msfs2024Path: settings.msfs2024Path || '',
        defaultResolution: settings.defaultResolution || '4K',
        defaultSimulator: settings.defaultSimulator || 'FS20'
      };
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }

  // FIX: Return proper defaults
  return {
    msfs2020Path: '',
    msfs2024Path: '',
    defaultResolution: '4K',
    defaultSimulator: 'FS20'
  };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return true;
  } catch (err) {
    console.error('Error saving settings:', err);
    return false;
  }
}

/* NON-BLOCKING ZIP EXTRACTION */
async function extractZipNonBlocking(zipPath, extractPath, liveryName) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      // Use PowerShell for Windows - much faster and non-blocking
      const psCommand = [
        '-Command',
        `Expand-Archive -Path "${zipPath}" -DestinationPath "${extractPath}" -Force`
      ];

      const child = spawn('powershell', psCommand);

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          // Fallback to AdmZip if PowerShell fails
          extractWithAdmZip(zipPath, extractPath).then(resolve).catch(reject);
        }
      });

      child.on('error', (error) => {
        console.log('PowerShell extraction failed, falling back to AdmZip:', error);
        extractWithAdmZip(zipPath, extractPath).then(resolve).catch(reject);
      });
    } else {
      // Use native unzip for Mac/Linux
      const child = spawn('unzip', ['-o', zipPath, '-d', extractPath]);

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          extractWithAdmZip(zipPath, extractPath).then(resolve).catch(reject);
        }
      });

      child.on('error', (error) => {
        console.log('Native unzip failed, falling back to AdmZip:', error);
        extractWithAdmZip(zipPath, extractPath).then(resolve).catch(reject);
      });
    }
  });
}

/* Fallback to AdmZip (still non-blocking using setImmediate) */
function extractWithAdmZip(zipPath, extractPath) {
  return new Promise((resolve, reject) => {
    setImmediate(() => {
      try {
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(extractPath, true);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

/* FILE DOWNLOAD HELPER */
async function downloadFile(url, filePath, onProgress) {
  const writer = fs.createWriteStream(filePath);
  const response = await fetchWithTimeout(url, { method: 'GET' }, 30000);

  if (!response.ok) {
    writer.close();
    throw createRequestError(response, url);
  }

  if (!response.body) {
    writer.close();
    throw new Error('Download response did not include a body stream');
  }

  const totalLengthHeader = response.headers.get('content-length');
  const totalLength = totalLengthHeader ? parseInt(totalLengthHeader, 10) : 0;
  let downloadedLength = 0;
  const nodeStream = Readable.fromWeb(response.body);

  return new Promise((resolve, reject) => {
    const handleError = (err) => {
      writer.destroy();
      nodeStream.destroy();
      fs.unlink(filePath, () => { });
      reject(err);
    };

    nodeStream.on('data', (chunk) => {
      downloadedLength += chunk.length;
      if (onProgress && totalLength) {
        const percent = Math.round((downloadedLength / totalLength) * 100);
        onProgress({
          percent,
          transferred: downloadedLength,
          total: totalLength
        });
      }
    });

    nodeStream.on('error', handleError);
    writer.on('error', handleError);

    writer.on('finish', () => {
      writer.close();
      resolve();
    });

    nodeStream.pipe(writer);
  });
}

/* CREATE MANIFEST FILE */
async function createManifestFile(extractPath, livery, resolution, simulator) {
  const manifestPath = path.join(extractPath, 'manifest.json');

  const manifest = {
    "dependencies": [],
    "content_type": "LIVERY",
    "title": livery.name || "Unknown Livery",
    "manufacturer": livery.manufacturer || livery.aircraftType || "Unknown",
    "creator": livery.developer || "Unknown",
    "package_version": livery.version || "1.0.0",
    "resolution": resolution,
    "minimum_game_version": "1.4.20",
    "minimum_compatibility_version": "4.20.0.73",
    "builder": simulator === 'FS24' ? "Microsoft Flight Simulator 2024" : "Microsoft Flight Simulator 2020",
    "release_notes": {
      "neutral": {
        "LastUpdate": new Date().toISOString(),
        "OlderHistory": ""
      }
    },
    "total_package_size": "00000000000000000000",
    // Custom fields for our manager
    "livery_manager_metadata": {
      "original_name": livery.name,
      "install_date": new Date().toISOString(),
      "source_url": livery.downloadUrl || "",
      "resolution": resolution,
      "simulator": simulator
    }
  };

  await fs.writeJson(manifestPath, manifest, { spaces: 2 });
  console.log('Created manifest file at:', manifestPath);
}

/* READ MANIFEST FILE */
async function readManifestFile(liveryPath) {
  try {
    const manifestPath = path.join(liveryPath, 'manifest.json');
    if (await fs.pathExists(manifestPath)) {
      const manifest = await fs.readJson(manifestPath);
      return manifest;
    }
    return null;
  } catch (error) {
    console.error('Error reading manifest file:', error);
    return null;
  }
}

/* IPC HANDLERS */
function setupIpcHandlers() {
  // Prevent double registration
  if (ipcHandlersSetup) {
    console.log('IPC handlers already setup, skipping...');
    return;
  }

  console.log('Setting up IPC handlers...');

  // Clear any existing handlers
  ipcMain.removeHandler('download-livery');
  ipcMain.removeHandler('fetch-liveries');
  ipcMain.removeHandler('get-settings');
  ipcMain.removeHandler('save-settings');
  ipcMain.removeHandler('open-directory-dialog');
  ipcMain.removeHandler('get-file-size');
  ipcMain.removeHandler('uninstall-livery');
  ipcMain.removeHandler('get-liveries-folders');
  ipcMain.removeHandler('path-exists');
  ipcMain.removeHandler('get-local-version');
  ipcMain.removeHandler('set-local-version');
  ipcMain.removeHandler('get-installed-liveries');
  ipcMain.removeHandler('read-manifest');
  ipcMain.removeHandler('detect-sim-paths');

  // File size handler
  ipcMain.handle('get-file-size', async (event, url) => {
    try {
      const response = await fetchWithTimeout(url, { method: 'HEAD' }, 5000);
      if (!response.ok) {
        throw createRequestError(response, url);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const sizeInBytes = parseInt(contentLength);
        return formatFileSize(sizeInBytes);
      }
      return 'Unknown';
    } catch (error) {
      console.error('Error getting file size:', error);
      return 'Unknown';
    }
  });

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Fetch liveries handler
  ipcMain.handle('fetch-liveries', async () => {
    try {
      console.log('Fetching liveries from remote server...');
      const data = await fetchJson(REMOTE_LIVERY_LIST_URL, 15000);
      console.log('Successfully fetched liveries from remote');
      return data;
    } catch (error) {
      console.error('Error fetching liveries from remote:', error);
      try {
        const localData = await fs.readFile(path.join(__dirname, 'public', 'list.json'), 'utf8');
        console.log('Loaded liveries from local file');
        return JSON.parse(localData);
      } catch (localError) {
        console.error('Failed to load local liveries:', localError);
        throw new Error('Failed to load liveries from both remote and local sources');
      }
    }
  });

  // Download livery handler
  ipcMain.handle('download-livery', async (event, downloadUrl, liveryName, simulator, resolution) => {
    console.log('=== DOWNLOAD STARTED ===');
    console.log('Download URL:', downloadUrl);
    console.log('Livery Name:', liveryName);
    console.log('Simulator:', simulator);
    console.log('Resolution:', resolution);

    try {
      const settings = loadSettings();
      let baseFolder = simulator === 'MSFS2024' && settings.msfs2024Path ?
        settings.msfs2024Path :
        settings.msfs2020Path;

      console.log('Base folder:', baseFolder);

      if (!baseFolder) {
        const errorMsg = 'No simulator path configured. Please set it in Settings.';
        console.error(errorMsg);
        return {
          success: false,
          error: errorMsg,
          path: ''
        };
      }

      // Ensure base folder exists
      await fs.ensureDir(baseFolder);

      const zipFilename = path.basename(downloadUrl);
      const folderName = zipFilename.replace('.zip', '');
      const outputPath = path.join(baseFolder, zipFilename);
      const extractPath = path.join(baseFolder, folderName);

      console.log('File paths:', { outputPath, extractPath });

      // Download the file with progress
      await downloadFile(downloadUrl, outputPath, (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-progress', {
            liveryName,
            progress: progress.percent,
            downloaded: progress.transferred,
            total: progress.total
          });
        }
      });

      // Send extraction started message
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-progress', {
          liveryName,
          progress: 100,
          extracting: true
        });
      }

      console.log('Starting non-blocking extraction...');

      // Extract using non-blocking method
      await extractZipNonBlocking(outputPath, extractPath, liveryName);

      // Find the livery data to create manifest
      const data = await fetchLiveriesForManifest();
      const livery = data.liveries.find(l => l.name === liveryName);

      if (livery) {
        // Create manifest file with resolution information
        await createManifestFile(extractPath, livery, resolution, simulator);
      }

      // Clean up the zip file
      await fs.remove(outputPath);

      console.log('Download and extraction completed successfully');

      return {
        success: true,
        path: extractPath
      };
    } catch (error) {
      console.error('Download process failed:', error);
      return {
        success: false,
        error: error.message,
        details: typeof error.status === 'number' ? `Server responded with ${error.status}` : undefined
      };
    }
  });

  // Helper function for download handler
  async function fetchLiveriesForManifest() {
    try {
      return await fetchJson(REMOTE_LIVERY_LIST_URL, 15000);
    } catch (error) {
      // Fallback to local file
      const localData = await fs.readFile(path.join(__dirname, 'public', 'list.json'), 'utf8');
      return JSON.parse(localData);
    }
  }

  // Read manifest handler
  ipcMain.handle('read-manifest', async (event, liveryPath) => {
    return await readManifestFile(liveryPath);
  });

  ipcMain.handle('detect-sim-paths', async () => {
    return await detectSimulatorPaths();
  });

  // Uninstall livery handler
  ipcMain.handle('uninstall-livery', async (event, liveryPath) => {
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
      return { success: false, error: error.message };
    }
  });

  // Settings handlers
  ipcMain.handle('get-settings', () => loadSettings());
  ipcMain.handle('save-settings', (event, settings) => saveSettings(settings));

  // Directory dialog handler
  ipcMain.handle('open-directory-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select MSFS Community Folder'
    });
    return result.filePaths[0] || null;
  });

  // File system handlers
  ipcMain.handle('get-liveries-folders', async (event, basePath) => {
    try {
      if (!await fs.pathExists(basePath)) return [];

      const items = await fs.readdir(basePath);
      const folders = [];

      for (const item of items) {
        // Skip known scenery packages and system folders
        if (item.startsWith('orbx-') ||
          item.startsWith('asobo-') ||
          item === 'Official' ||
          item === 'OneStore') {
          continue;
        }

        const itemPath = path.join(basePath, item);
        try {
          const stat = await fs.stat(itemPath);
          if (stat.isDirectory()) {
            folders.push(item);
          }
        } catch (error) {
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

  ipcMain.handle('path-exists', async (event, checkPath) => {
    return await fs.pathExists(checkPath);
  });

  // Version management handlers
  ipcMain.handle('get-local-version', (event, liveryId) => {
    return versionManager.getLocalVersion(liveryId);
  });

  ipcMain.handle('set-local-version', (event, liveryId, version) => {
    return versionManager.setLocalVersion(liveryId, version);
  });

  // Get installed liveries handler
  ipcMain.handle('get-installed-liveries', async (event, basePath) => {
    try {
      if (!await fs.pathExists(basePath)) return [];

      const folders = await fs.readdir(basePath);
      const installedLiveries = [];

      for (const folder of folders) {
        // Skip known scenery packages
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
        } catch (folderError) {
          continue;
        }
      }

      return installedLiveries;
    } catch (error) {
      console.error('Error getting installed liveries:', error);
      return [];
    }
  });

  ipcHandlersSetup = true;
  console.log('IPC handlers setup complete');
}

/* APP EVENT HANDLERS */
app.whenReady().then(() => {
  console.log('App ready, creating window...');
  createWindow();
  setupIpcHandlers();
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
    // Don't call setupIpcHandlers here again - they're already set up
  }
});

app.on('before-quit', () => {
  console.log('Application shutting down...');
});