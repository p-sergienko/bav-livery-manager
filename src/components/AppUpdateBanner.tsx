import { useCallback } from 'react';
import { useAppUpdateStore } from '@/store/appUpdateStore';
import { APP_VERSION } from '@/constants/appVersion';
import styles from './AppUpdateBanner.module.css';

const UpdateIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
);

const DownloadIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
);

const RocketIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
        <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
);

const CloseIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
);

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export const AppUpdateBanner = () => {
    const update = useAppUpdateStore((s) => s.update);
    const bannerDismissed = useAppUpdateStore((s) => s.bannerDismissed);
    const dismissBanner = useAppUpdateStore((s) => s.dismissBanner);
    const api = window.electronAPI;

    const handleDownload = useCallback(async () => {
        if (!api?.downloadAppUpdate) return;
        try {
            await api.downloadAppUpdate();
        } catch { /* state update handled by AppUpdateListener */ }
    }, [api]);

    const handleInstall = useCallback(() => {
        api?.installAppUpdate?.();
    }, [api]);

    const visible =
        !bannerDismissed &&
        (update.phase === 'available' || update.phase === 'downloading' || update.phase === 'downloaded');

    if (!visible) return null;

    return (
        <div className={styles.banner} role="status" aria-live="polite">
            {update.phase === 'available' && (
                <>
                    <div className={styles.row}>
                        <div className={styles.iconWrap}>
                            <UpdateIcon />
                        </div>
                        <div className={styles.text}>
                            <span className={styles.title}>Update available</span>
                            <span className={styles.sub}>
                                v{APP_VERSION} &rarr; <strong>{update.version}</strong>
                            </span>
                        </div>
                        <div className={styles.actions}>
                            <button className={styles.downloadBtn} onClick={handleDownload}>
                                <DownloadIcon />
                                Download
                            </button>
                            <button className={styles.dismissBtn} onClick={dismissBanner} aria-label="Dismiss">
                                <CloseIcon />
                            </button>
                        </div>
                    </div>
                </>
            )}

            {update.phase === 'downloading' && (
                <>
                    <div className={styles.row}>
                        <div className={styles.iconWrapBlue}>
                            <DownloadIcon />
                        </div>
                        <div className={styles.text}>
                            <span className={styles.title}>Downloading update…</span>
                            <span className={styles.sub}>
                                {formatBytes(update.transferred)} / {formatBytes(update.total)}
                                {update.bytesPerSecond > 0 && ` · ${formatBytes(update.bytesPerSecond)}/s`}
                            </span>
                        </div>
                        <span className={styles.percent}>{Math.round(update.percent)}%</span>
                    </div>
                    <div className={styles.progressTrack}>
                        <div className={styles.progressFill} style={{ width: `${update.percent}%` }} />
                    </div>
                </>
            )}

            {update.phase === 'downloaded' && (
                <div className={styles.row}>
                    <div className={styles.iconWrapGreen}>
                        <RocketIcon />
                    </div>
                    <div className={styles.text}>
                        <span className={styles.titleGreen}>Ready to install</span>
                        <span className={styles.sub}>{update.version}</span>
                    </div>
                    <div className={styles.actions}>
                        <button className={styles.installBtn} onClick={handleInstall}>
                            <RocketIcon />
                            Restart & Install
                        </button>
                        <button className={styles.dismissBtn} onClick={dismissBanner} aria-label="Dismiss">
                            <CloseIcon />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
