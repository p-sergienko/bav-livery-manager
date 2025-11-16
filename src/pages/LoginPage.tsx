import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PANEL_PORTAL_URL } from '@/config/auth';
import { useAuthStore } from '@/store/authStore';
import styles from './LoginPage.module.css';

const buildPortalUrl = () => {
    const url = new URL(PANEL_PORTAL_URL);
    url.searchParams.set('client', 'bav-livery-manager');
    return url.toString();
};

export const LoginPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const status = useAuthStore((state) => state.status);
    const error = useAuthStore((state) => state.error);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const markAwaitingAuth = useAuthStore((state) => state.markAwaitingAuth);
    const setError = useAuthStore((state) => state.setError);

    const [lastAttempt, setLastAttempt] = useState<number | null>(null);
    const fromPath = (location.state as { from?: string })?.from ?? '/search';

    useEffect(() => {
        if (isAuthenticated) {
            navigate(fromPath, { replace: true });
        }
    }, [fromPath, isAuthenticated, navigate]);

    const openPortal = useCallback(async () => {
        const api = window.electronAPI;
        if (!api?.openPanelAuth) {
            setError('Unable to open secure browser login. Please reinstall the app.');
            return;
        }

        markAwaitingAuth();
        setError(null);
        await api.openPanelAuth(buildPortalUrl());
        setLastAttempt(Date.now());
    }, [markAwaitingAuth, setError]);

    useEffect(() => {
        openPortal().catch((err) => {
            console.error('Failed to open panel auth flow', err);
        });
    }, [openPortal]);

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.titleGroup}>
                    <img alt="logo" src="https://pub-505cce096f5e4523867626e0594f0337.r2.dev/InstallerLogo.png" />
                    <h1>Authenticate via browser</h1>
                    <p>To use the manager you need to sign in with your BAV account.</p>
                </div>

                <div className={styles.notice}>
                    <ol>
                        <li>Enter your BAW ID and password inside the browser window.</li>
                        <li>After a successful login, the browser will reopen this app automatically.</li>
                        <li>You can return here at any time and press the button below to relaunch the portal.</li>
                    </ol>
                </div>

                {error && <p className={styles.error}>{error}</p>}

                <button className={styles.button} type="button" onClick={() => openPortal()}>
                    {status === 'awaiting-browser' ? 'Waiting for confirmation…' : 'Open login page'}
                </button>

                {lastAttempt && (
                    <p className={styles.helper}>
                        Last attempt: {new Date(lastAttempt).toLocaleTimeString()} — keep this window open until we
                        detect your token.
                    </p>
                )}
            </div>
        </div>
    );
};
