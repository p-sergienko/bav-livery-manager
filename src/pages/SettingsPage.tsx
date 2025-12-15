import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveryStore } from '@/store/liveryStore';
import { useAuthStore } from '@/store/authStore';
import { Toast } from '@/components/Toast';
import styles from './SettingsPage.module.css';
import { BAVIcon } from "@/components/Icons/BAVIcon";

export const SettingsPage = () => {
    const settings = useLiveryStore((state) => state.settings);
    const updateSettings = useLiveryStore((state) => state.updateSettings);

    const userId = useAuthStore((state) => state.userId);
    const fullName = useAuthStore((state) => state.fullName);
    const rank = useAuthStore((state) => state.rank);
    const logout = useAuthStore((state) => state.logout);
    const navigate = useNavigate();

    const [formState, setFormState] = useState(settings);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [detecting, setDetecting] = useState(false);

    useEffect(() => {
        setFormState(settings);
    }, [settings]);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
    };

    const handleBrowse = async (field: 'msfs2020Path' | 'msfs2024Path') => {
        const selected = await window.electronAPI?.openDirectoryDialog?.();
        if (selected) {
            setFormState((prev) => ({ ...prev, [field]: selected }));
        }
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        await updateSettings(formState);
        showToast('Settings saved successfully.');
    };

    const handleAutoDetect = async () => {
        if (!window.electronAPI?.detectSimPaths) {
            showToast('Auto-detect is only available in the desktop app.', 'error');
            return;
        }

        setDetecting(true);
        try {
            const detected = await window.electronAPI.detectSimPaths();
            if (!detected) {
                showToast('No simulator installations were found.', 'error');
                return;
            }

            const updates: Partial<typeof formState> = {};
            if (detected.msfs2020Path) updates.msfs2020Path = detected.msfs2020Path;
            if (detected.msfs2024Path) updates.msfs2024Path = detected.msfs2024Path;

            if (Object.keys(updates).length) {
                setFormState((prev) => ({ ...prev, ...updates }));
                showToast('Detected simulator folders. Review and save to apply.');
            } else {
                showToast('No simulator installations were found.', 'error');
            }
        } catch (error) {
            console.error('Auto-detect failed', error);
            showToast('Unable to detect simulator folders.', 'error');
        } finally {
            setDetecting(false);
        }
    };

    const handleSignOut = () => {
        logout();
        navigate('/login', { replace: true });
    };

    const handleOpenGitHub = () => {
        const url = 'https://github.com/p-sergienko/bav-livery-manager';
        if (window.electronAPI?.openExternalLink) {
            window.electronAPI.openExternalLink(url).catch((err) => console.error('openExternalLink failed', err));
            return;
        }

        // Fallback for web: open in new tab/window
        try {
            window.open(url, '_blank', 'noopener');
        } catch (err) {
            console.error('Failed to open GitHub page', err);
        }
    };

    const handleOpenBAV = () => {
        const url = 'https://www.bavirtual.co.uk';
        if (window.electronAPI?.openExternalLink) {
            window.electronAPI.openExternalLink(url).catch((err) => console.error('openExternalLink failed', err));
            return;
        }

        // Fallback for web: open in new tab/window
        try {
            window.open(url, '_blank', 'noopener');
        } catch (err) {
            console.error('Failed to open BAV page', err);
        }
    };

    return (
        <section className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Settings</h1>
                    <p className={styles.description}>Manage your account and simulator paths.</p>
                </div>
            </header>

            <div className={styles.accountCard}>
                <div className={styles.accountHeader}>
                    <div className={styles.accountAvatar}>
                        {(fullName ?? userId ?? 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.accountInfo}>
                        <p className={styles.accountName}>{fullName ?? 'Unknown User'}</p>
                        <p className={styles.accountId}>{userId ?? '—'}{rank ? ` • ${rank}` : ''}</p>
                    </div>
                    <button type="button" className={styles.signOutButton} onClick={handleSignOut}>
                        Sign out
                    </button>
                </div>
            </div>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <form className={styles.form} onSubmit={handleSubmit}>
                <label className={styles.pathInput}>
                    <span className={styles.label}>MSFS 2020 Community Folder</span>
                    <div className={styles.inputRow}>
                        <input value={formState.msfs2020Path} onChange={(e) => setFormState((prev) => ({ ...prev, msfs2020Path: e.target.value }))} />
                        <button type="button" onClick={() => handleBrowse('msfs2020Path')}>
                            Browse
                        </button>
                    </div>
                </label>

                <label className={styles.pathInput}>
                    <span className={styles.label}>MSFS 2024 Community Folder</span>
                    <div className={styles.inputRow}>
                        <input value={formState.msfs2024Path} onChange={(e) => setFormState((prev) => ({ ...prev, msfs2024Path: e.target.value }))} />
                        <button type="button" onClick={() => handleBrowse('msfs2024Path')}>
                            Browse
                        </button>
                    </div>
                </label>
                <p className={styles.description}>Note: if you don't use the community folder, you can change the path to your custom community directory.</p>
                <div className={styles.formActions}>
                    <button type="submit" className={styles.submitButton}>
                        Save Settings
                    </button>
                    <button type="button" className={styles.detectButton} onClick={handleAutoDetect} disabled={detecting}>
                        {detecting ? 'Detecting…' : 'Auto-detect paths'}
                    </button>
                </div>
            </form>

            <footer className={styles.footer}>
                <p className={styles.footerText}>
                    Created by <span className={styles.footerAuthor}>Pavel Sergienko</span>, inspired by <span className={styles.footerAuthor}>Laurie Cooper</span>, made for <span className={styles.footerAuthor}>BAV Community</span>
                </p>
                <p className={styles.secondFooterText}>© {new Date().getFullYear()} - BAV Livery Manager</p>
                <div className={styles.footerButtons}>
                    <button type="button" className={styles.footerButton} onClick={handleOpenGitHub}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                        </svg>
                        View on GitHub
                    </button>
                    <button type="button" className={styles.footerButton} onClick={handleOpenBAV}>
                        <BAVIcon width={26} height={26} color={"#ffffff"}/>
                        BAV website
                    </button>
                </div>
            </footer>
        </section>
    );
};
