import { useEffect, useState, useCallback } from 'react';
import type { AppUpdateStatus } from '@/types/electron-api';
import { APP_VERSION } from '@/constants/appVersion';
import styles from './AppUpdater.module.css';

type UpdateState =
    | { phase: 'idle' }
    | { phase: 'checking' }
    | { phase: 'available'; version: string; releaseDate?: string }
    | { phase: 'up-to-date' }
    | { phase: 'downloading'; percent: number; bytesPerSecond: number; transferred: number; total: number }
    | { phase: 'downloaded'; version: string }
    | { phase: 'error'; message: string };

const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const DownloadIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

const RefreshIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
);

const RocketIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
        <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
);

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export const AppUpdater = () => {
    const [state, setState] = useState<UpdateState>({ phase: 'idle' });
    const api = window.electronAPI;

    useEffect(() => {
        if (!api?.onAppUpdateStatus) return;

        api.onAppUpdateStatus((status: AppUpdateStatus) => {
            switch (status.status) {
                case 'checking':
                    setState({ phase: 'checking' });
                    break;
                case 'available':
                    setState({
                        phase: 'available',
                        version: status.version || 'unknown',
                        releaseDate: status.releaseDate,
                    });
                    break;
                case 'not-available':
                    setState({ phase: 'up-to-date' });
                    break;
                case 'downloading':
                    setState({
                        phase: 'downloading',
                        percent: status.percent || 0,
                        bytesPerSecond: status.bytesPerSecond || 0,
                        transferred: status.transferred || 0,
                        total: status.total || 0,
                    });
                    break;
                case 'downloaded':
                    setState({
                        phase: 'downloaded',
                        version: status.version || 'unknown',
                    });
                    break;
                case 'error':
                    setState({
                        phase: 'error',
                        message: status.error || 'An unknown error occurred',
                    });
                    break;
            }
        });

        return () => {
            api.removeAppUpdateListeners?.();
        };
    }, [api]);

    const handleCheckForUpdate = useCallback(async () => {
        if (!api?.checkForAppUpdate) return;
        setState({ phase: 'checking' });
        try {
            await api.checkForAppUpdate();
        } catch {
            setState({ phase: 'error', message: 'Failed to check for updates' });
        }
    }, [api]);

    const handleDownloadUpdate = useCallback(async () => {
        if (!api?.downloadAppUpdate) return;
        try {
            await api.downloadAppUpdate();
        } catch {
            setState({ phase: 'error', message: 'Failed to download update' });
        }
    }, [api]);

    const handleInstallUpdate = useCallback(() => {
        api?.installAppUpdate?.();
    }, [api]);

    const renderContent = () => {
        switch (state.phase) {
            case 'idle':
                return (
                    <div className={styles.statusRow}>
                        <div className={styles.statusInfo}>
                            <span className={styles.versionLabel}>Current version</span>
                            <span className={styles.versionNumber}>v{APP_VERSION}</span>
                        </div>
                        <button className={styles.checkButton} onClick={handleCheckForUpdate}>
                            <RefreshIcon />
                            Check for updates
                        </button>
                    </div>
                );

            case 'checking':
                return (
                    <div className={styles.statusRow}>
                        <div className={styles.statusInfo}>
                            <span className={styles.versionLabel}>Current version</span>
                            <span className={styles.versionNumber}>v{APP_VERSION}</span>
                        </div>
                        <div className={styles.checkingState}>
                            <div className={styles.spinner} />
                            <span>Checking for updates…</span>
                        </div>
                    </div>
                );

            case 'up-to-date':
                return (
                    <div className={styles.statusRow}>
                        <div className={styles.statusInfo}>
                            <div className={styles.upToDateBadge}>
                                <CheckIcon />
                                <span>Up to date</span>
                            </div>
                            <span className={styles.versionNumber}>v{APP_VERSION}</span>
                        </div>
                        <button className={styles.checkButton} onClick={handleCheckForUpdate}>
                            <RefreshIcon />
                            Check again
                        </button>
                    </div>
                );

            case 'available':
                return (
                    <div className={styles.updateAvailable}>
                        <div className={styles.statusRow}>
                            <div className={styles.statusInfo}>
                                <span className={styles.versionLabel}>Update available</span>
                                <span className={styles.versionTransition}>
                                    v{APP_VERSION} → <strong>{state.version}</strong>
                                </span>
                            </div>
                            <button className={styles.downloadButton} onClick={handleDownloadUpdate}>
                                <DownloadIcon />
                                Download update
                            </button>
                        </div>
                    </div>
                );

            case 'downloading':
                return (
                    <div className={styles.downloadProgress}>
                        <div className={styles.statusRow}>
                            <div className={styles.statusInfo}>
                                <span className={styles.versionLabel}>Downloading update…</span>
                                <span className={styles.downloadStats}>
                                    {formatBytes(state.transferred)} / {formatBytes(state.total)}
                                    {state.bytesPerSecond > 0 && ` • ${formatBytes(state.bytesPerSecond)}/s`}
                                </span>
                            </div>
                            <span className={styles.percentLabel}>{Math.round(state.percent)}%</span>
                        </div>
                        <div className={styles.progressBar}>
                            <div
                                className={styles.progressFill}
                                style={{ width: `${state.percent}%` }}
                            />
                        </div>
                    </div>
                );

            case 'downloaded':
                return (
                    <div className={styles.updateReady}>
                        <div className={styles.statusRow}>
                            <div className={styles.statusInfo}>
                                <span className={styles.readyLabel}>Ready to install</span>
                                <span className={styles.versionNumber}>{state.version}</span>
                            </div>
                            <button className={styles.installButton} onClick={handleInstallUpdate}>
                                <RocketIcon />
                                Restart & install
                            </button>
                        </div>
                        <p className={styles.installHint}>
                            The update will also be installed automatically the next time you restart the app.
                        </p>
                    </div>
                );

            case 'error':
                return (
                    <div className={styles.statusRow}>
                        <div className={styles.statusInfo}>
                            <span className={styles.errorLabel}>Update check failed</span>
                            <span className={styles.errorMessage}>{state.message}</span>
                        </div>
                        <button className={styles.checkButton} onClick={handleCheckForUpdate}>
                            <RefreshIcon />
                            Retry
                        </button>
                    </div>
                );
        }
    };

    return <div className={styles.container}>{renderContent()}</div>;
};
