import path from 'node:path';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import fs from 'fs-extra';
import AdmZip from 'adm-zip';
import type { AppContext, DownloadProgress, DownloadResult, RemoteLiveryPayload, Settings } from '../types';
import { fetchJson, fetchWithTimeout } from '../utils/network';
import { createManifestFile } from './liveryData';

interface DownloadLiveryOptions {
    downloadEndpoint: string;
    liveryName: string;
    simulator: 'MSFS2020' | 'MSFS2024';
    resolution: string;
    settings: Settings;
    appContext: AppContext;
    fetchManifestData: (authToken: string | null) => Promise<RemoteLiveryPayload | null>;
    authToken: string | null;
}

const DOWNLOAD_ATTEMPTS = 3;
const RESOLVE_ATTEMPTS = 2;
const BACKOFF_MS = 800;

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]+/g;

function deriveZipFilename(downloadUrl: string): string {
    const buildName = (raw?: string | null) => {
        if (!raw) {
            return '';
        }
        return raw.replace(INVALID_FILENAME_CHARS, '_');
    };

    try {
        const parsed = new URL(downloadUrl);
        const fromPath = buildName(path.basename(parsed.pathname));
        if (fromPath) {
            return fromPath;
        }
    } catch {
        // Non-absolute URL, fall back to manual parsing
    }

    const withoutQuery = downloadUrl.split(/[?#]/)[0];
    const fallback = buildName(path.basename(withoutQuery));
    if (fallback) {
        return fallback;
    }

    return `livery-${Date.now()}.zip`;
}

export async function downloadAndInstallLivery(options: DownloadLiveryOptions): Promise<DownloadResult> {
    const { downloadEndpoint, liveryName, simulator, resolution, settings, appContext, fetchManifestData, authToken } = options;

    if (!authToken) {
        return { success: false, error: 'Missing authentication token. Please sign in again.' };
    }

    const signedDownload = await retryAsync(() => resolveDownloadEndpoint(downloadEndpoint, authToken), RESOLVE_ATTEMPTS, BACKOFF_MS);
    const downloadUrl = signedDownload.downloadUrl;

    const baseFolder = simulator === 'MSFS2024' && settings.msfs2024Path ? settings.msfs2024Path : settings.msfs2020Path;

    if (!baseFolder) {
        const errorMsg = 'No simulator path configured. Please set it in Settings.';
        console.error(errorMsg);
        return { success: false, error: errorMsg, path: '' };
    }

    await fs.ensureDir(baseFolder);

    const zipFilename = deriveZipFilename(downloadUrl);
    const folderName = zipFilename.replace(/\.zip$/i, '');
    const outputPath = path.join(baseFolder, zipFilename);
    const extractPath = path.join(baseFolder, folderName);

    console.log('Starting download', { downloadUrl, outputPath, extractPath });

    try {
        await retryAsync(() => downloadFile(downloadUrl, outputPath, (progress) => {
            const targetWindow = appContext.getMainWindow();
            if (!targetWindow || targetWindow.isDestroyed()) {
                return;
            }

            targetWindow.webContents.send('download-progress', {
                liveryName,
                progress: progress.percent,
                downloaded: progress.transferred,
                total: progress.total
            });
        }), DOWNLOAD_ATTEMPTS, BACKOFF_MS);

        const targetWindow = appContext.getMainWindow();
        if (targetWindow && !targetWindow.isDestroyed()) {
            targetWindow.webContents.send('download-progress', {
                liveryName,
                progress: 100,
                extracting: true
            });
        }

        await extractZipNonBlocking(outputPath, extractPath);

        const manifestData = await fetchManifestData(authToken);
        const livery = manifestData?.liveries?.find((entry) => entry.name === liveryName);
        if (livery) {
            await createManifestFile(extractPath, livery, resolution, simulator === 'MSFS2024' ? 'FS24' : 'FS20');
        }

        await fs.remove(outputPath);

        return {
            success: true,
            path: extractPath
        };
    } catch (error) {
        console.error('Download process failed:', error);
        const status = (error as Error & { status?: number }).status;
        return {
            success: false,
            error: (error as Error).message,
            details: typeof status === 'number' ? `Server responded with ${status}` : undefined
        };
    }
}

async function downloadFile(url: string, filePath: string, onProgress?: (progress: DownloadProgress) => void) {
    const writer = fs.createWriteStream(filePath);
    const response = await fetchWithTimeout(url, { method: 'GET' }, 30000);

    if (!response.body) {
        writer.close();
        throw new Error('Download response did not include a body stream');
    }

    const totalLengthHeader = response.headers.get('content-length');
    const totalLength = totalLengthHeader ? parseInt(totalLengthHeader, 10) : 0;
    let downloadedLength = 0;
    const nodeStream = Readable.fromWeb(response.body as unknown as NodeReadableStream);

    return new Promise<void>((resolve, reject) => {
        const handleError = async (error: Error) => {
            writer.destroy();
            nodeStream.destroy();
            try {
                await fs.remove(filePath);
            } catch {
                // no-op
            }
            reject(error);
        };

        nodeStream.on('data', (chunk: Buffer) => {
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

        nodeStream.on('error', (error) => handleError(error as Error));
        writer.on('error', (error) => handleError(error as Error));

        writer.on('finish', () => {
            writer.close();
            resolve();
        });

        nodeStream.pipe(writer);
    });
}

interface SignedDownloadPayload {
    downloadUrl: string;
    expiresAt: string;
    sizeBytes?: number;
    version?: string;
}

async function resolveDownloadEndpoint(endpoint: string, authToken: string | null): Promise<SignedDownloadPayload> {
    const headers: HeadersInit = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    return fetchJson<SignedDownloadPayload>(endpoint, { headers }, 15000);
}

async function extractZipNonBlocking(zipPath: string, extractPath: string) {
    return new Promise<void>((resolve, reject) => {
        const isWindows = process.platform === 'win32';

        if (isWindows) {
            const psCommand = [
                '-Command',
                `Expand-Archive -Path "${zipPath}" -DestinationPath "${extractPath}" -Force`
            ];

            const child = spawn('powershell', psCommand);

            child.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    extractWithAdmZip(zipPath, extractPath).then(resolve).catch(reject);
                }
            });

            child.on('error', (error) => {
                console.log('PowerShell extraction failed, falling back to AdmZip:', error);
                extractWithAdmZip(zipPath, extractPath).then(resolve).catch(reject);
            });
        } else {
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

function extractWithAdmZip(zipPath: string, extractPath: string) {
    return new Promise<void>((resolve, reject) => {
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
