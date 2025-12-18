import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import * as fs from 'fs-extra';
import AdmZip from 'adm-zip';
import type { AppContext, DownloadProgress, DownloadResult, Settings } from '../types';
import { fetchJson, fetchWithTimeout } from '../utils/network';
import { recordInstallation } from './installedLiveriesStore';
import { PANEL_BASE_URL } from '../../shared/constants';

interface DownloadLiveryOptions {
    downloadEndpoint: string;
    liveryId: string;
    liveryName: string;
    simulator: 'MSFS2020' | 'MSFS2024';
    resolution: string;
    settings: Settings;
    appContext: AppContext;
    authToken: string | null;
}

const DOWNLOAD_ATTEMPTS = 3;
const RESOLVE_ATTEMPTS = 2;
const BACKOFF_MS = 800;

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]+/g;

async function retryAsync<T>(
    fn: () => Promise<T>,
    attempts: number,
    backoffMs: number
): Promise<T> {
    let lastError: Error | undefined;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (i < attempts - 1) {
                await new Promise((resolve) => setTimeout(resolve, backoffMs * (i + 1)));
            }
        }
    }
    throw lastError ?? new Error('retryAsync failed');
}

function deriveZipFilename(downloadUrl: string): string {
    const buildName = (raw?: string | null) => {
        if (!raw) {
            return '';
        }
        return raw.replace(INVALID_FILENAME_CHARS, '_');
    };

    try {
        const parsed = new URL(downloadUrl);
        const fromPath = buildName(path.basename(parsed.pathname)).replace(/^[^-]+-[^-]+-/, '');
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
    const { downloadEndpoint, liveryId, liveryName, simulator, resolution, settings, appContext, authToken } = options;

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

            // Update taskbar progress
            targetWindow.setProgressBar(progress.percent / 100, { mode: 'normal' });
        }), DOWNLOAD_ATTEMPTS, BACKOFF_MS);

        const targetWindow = appContext.getMainWindow();
        if (targetWindow && !targetWindow.isDestroyed()) {
            targetWindow.webContents.send('download-progress', {
                liveryName,
                progress: 100,
                extracting: true
            });

            // Set taskbar to indeterminate mode during extraction
            targetWindow.setProgressBar(2, { mode: 'indeterminate' });
        }

        await extractZipNonBlocking(outputPath, extractPath);

        // Record the installation in our local store (not in the livery folder)
        const simCode = simulator === 'MSFS2024' ? 'FS24' : 'FS20';
        await recordInstallation({
            liveryId,
            originalName: liveryName,
            folderName,
            installPath: extractPath,
            resolution,
            simulator: simCode,
            version: '1.0.0'
        });

        await fs.remove(outputPath);

        // Track the download completion
        try {
            await trackDownloadCompletion(liveryId, simulator, resolution, authToken);
        } catch (trackError) {
            console.warn('Failed to track download, but installation succeeded:', trackError);
        }

        // Clear taskbar progress
        const finalWindow = appContext.getMainWindow();
        if (finalWindow && !finalWindow.isDestroyed()) {
            finalWindow.setProgressBar(-1);
        }

        return {
            success: true,
            path: extractPath
        };
    } catch (error) {
        console.error('Download process failed:', error);

        // Set taskbar to error state briefly, then clear
        const errorWindow = appContext.getMainWindow();
        if (errorWindow && !errorWindow.isDestroyed()) {
            errorWindow.setProgressBar(1, { mode: 'error' });
            setTimeout(() => {
                if (errorWindow && !errorWindow.isDestroyed()) {
                    errorWindow.setProgressBar(-1);
                }
            }, 2000);
        }

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
        const psCommand = [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-Command',
            `& {
                    param($ZipPath, $DestPath)
                    Expand-Archive -LiteralPath $ZipPath -DestinationPath $DestPath -Force
                    if ($?) { exit 0 } else { exit 1 }
                } -ZipPath '${zipPath.replace(/'/g, "''")}' -DestPath '${extractPath.replace(/'/g, "''")}'`
        ];

        const child = spawn('powershell.exe', psCommand);

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                console.log('PowerShell extraction failed, falling back to AdmZip');
                extractWithAdmZip(zipPath, extractPath).then(resolve).catch(reject);
            }
        });

        child.on('error', (error) => {
            console.log('PowerShell process failed, falling back to AdmZip:', error);
            extractWithAdmZip(zipPath, extractPath).then(resolve).catch(reject);
        });
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

async function trackDownloadCompletion(
    liveryId: string,
    simulator: 'MSFS2020' | 'MSFS2024',
    resolution: string,
    authToken: string
): Promise<void> {
    const simCode = simulator === 'MSFS2024' ? 'FS24' : 'FS20';
    const trackUrl = `${PANEL_BASE_URL}/api/simulator/liveries/${liveryId}/track`;

    try {
        const response = await fetchWithTimeout(trackUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                simulator: simCode,
                resolution
            })
        }, 10000);

        if (!response.ok) {
            const statusText = response.statusText || 'Unknown error';
            console.warn(`Download tracking failed: ${response.status} ${statusText}`);
        }
    } catch (error) {
        // Log but don't throw - tracking failures shouldn't prevent downloads
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn('Failed to track download:', errorMessage);
        throw error;
    }
}
