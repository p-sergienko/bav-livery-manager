import { useState } from 'react';
import { useLiveryStore } from '@/store/liveryStore';
import type { LiveryUpdate } from '@/types/livery';
import styles from './UpdateNotification.module.css';

const UpdateIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
);

const CloseIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

export const UpdateNotification = () => {
    const availableUpdates = useLiveryStore((state) => state.availableUpdates);
    const updateLivery = useLiveryStore((state) => state.updateLivery);
    const dismissUpdate = useLiveryStore((state) => state.dismissUpdate);
    const checkForUpdates = useLiveryStore((state) => state.checkForUpdates);
    const checkingUpdates = useLiveryStore((state) => state.checkingUpdates);
    
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

    const handleUpdate = async (update: LiveryUpdate) => {
        setUpdatingIds(prev => new Set(prev).add(update.liveryId));
        try {
            await updateLivery(update);
        } finally {
            setUpdatingIds(prev => {
                const next = new Set(prev);
                next.delete(update.liveryId);
                return next;
            });
        }
    };

    const handleDismiss = (liveryId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        dismissUpdate(liveryId);
    };

    const toggleExpand = (liveryId: string) => {
        setExpandedId(expandedId === liveryId ? null : liveryId);
    };

    if (availableUpdates.length === 0 && !checkingUpdates) {
        return null;
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerContent}>
                    <UpdateIcon />
                    <h3 className={styles.title}>
                        {checkingUpdates 
                            ? 'Checking for updates...' 
                            : `${availableUpdates.length} update${availableUpdates.length === 1 ? '' : 's'} available`}
                    </h3>
                </div>
                <button 
                    className={styles.refreshButton}
                    onClick={() => checkForUpdates()}
                    disabled={checkingUpdates}
                    aria-label="Check for updates"
                    title="Check for updates"
                >
                    <UpdateIcon />
                </button>
            </div>

            {availableUpdates.length > 0 && (
                <div className={styles.updateList}>
                    {availableUpdates.map((update) => {
                        const isExpanded = expandedId === update.liveryId;
                        const isUpdating = updatingIds.has(update.liveryId);

                        return (
                            <div key={update.liveryId} className={styles.updateItem}>
                                <div 
                                    className={styles.updateHeader}
                                    onClick={() => toggleExpand(update.liveryId)}
                                >
                                    <div className={styles.updateInfo}>
                                        <span className={styles.liveryName}>{update.liveryName}</span>
                                        <span className={styles.versionInfo}>
                                            {update.currentVersion} → {update.latestVersion}
                                        </span>
                                    </div>
                                    <button
                                        className={styles.dismissButton}
                                        onClick={(e) => handleDismiss(update.liveryId, e)}
                                        aria-label="Dismiss update"
                                        title="Dismiss"
                                    >
                                        <CloseIcon />
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className={styles.updateDetails}>
                                        {update.changelog && (
                                            <div className={styles.changelog}>
                                                <p className={styles.changelogLabel}>What's new:</p>
                                                <p className={styles.changelogText}>{update.changelog}</p>
                                            </div>
                                        )}
                                        
                                        <div className={styles.metadata}>
                                            {update.resolution && (
                                                <span className={styles.metaItem}>Resolution: {update.resolution}</span>
                                            )}
                                            {update.simulator && (
                                                <span className={styles.metaItem}>Simulator: {update.simulator}</span>
                                            )}
                                        </div>

                                        <button
                                            className={styles.updateButton}
                                            onClick={() => handleUpdate(update)}
                                            disabled={isUpdating}
                                        >
                                            {isUpdating ? 'Updating...' : 'Update Now'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
