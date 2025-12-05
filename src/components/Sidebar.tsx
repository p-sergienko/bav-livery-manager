import { NavLink } from 'react-router-dom';
import { DownloadProgress } from './DownloadProgress';
import { UpdateBadge } from './UpdateBadge';
import { APP_VERSION } from '@/constants/appVersion';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
    { label: 'Search', to: '/search', icon: 'search' },
    { label: 'Downloads', to: '/downloads', icon: 'download' },
    { label: 'Settings', to: '/settings', icon: 'settings' }
];

const LOGO_URL = 'https://pub-505cce096f5e4523867626e0594f0337.r2.dev/InstallerLogo.png';

const Icon = ({ name }: { name: string }) => {
    switch (name) {
        case 'download':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
            );
        case 'settings':
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.18a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
            );
        default:
            return (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
            );
    }
};

const classNames = (...tokens: Array<string | false | undefined>) => tokens.filter(Boolean).join(' ');

export const Sidebar = () => {
    return (
        <aside className={styles.sidePanel}>
            <div className={styles.topSection}>
                <div className={styles.panelHeader}>
                    <h2>Livery Manager</h2>
                </div>
                <nav className={styles.panelButtons}>
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                classNames(styles.panelButton, isActive && styles.panelButtonActive)
                            }
                        >
                            <Icon name={item.icon} />
                            <span>{item.label}</span>
                            {item.to === '/downloads' && <UpdateBadge />}
                        </NavLink>
                    ))}
                </nav>
            </div>

            <div className={styles.middleSection}>
                <DownloadProgress />
            </div>

            <div className={styles.footer}>
                <div className={styles.versionBadge}>v{APP_VERSION}</div>
                <div className={styles.sidebarLogo}>
                    <img className={styles.logoImage} src={LOGO_URL} alt="Livery Manager" />
                </div>
            </div>
        </aside>
    );
};
