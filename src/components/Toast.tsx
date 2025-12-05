import { useEffect, useState } from 'react';
import styles from './Toast.module.css';

export interface ToastProps {
    message: string;
    type?: 'error' | 'success' | 'info';
    duration?: number;
    onClose: () => void;
}

const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

const ErrorIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
);

const SuccessIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

const InfoIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
);

const iconMap = {
    error: ErrorIcon,
    success: SuccessIcon,
    info: InfoIcon
};

export const Toast = ({ message, type = 'error', duration = 6000, onClose }: ToastProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => setIsVisible(true));

        const timer = setTimeout(() => {
            handleClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration]);

    const handleClose = () => {
        setIsLeaving(true);
        setTimeout(() => {
            onClose();
        }, 300); // Match exit animation duration
    };

    const Icon = iconMap[type];

    return (
        <div
            className={`${styles.toast} ${styles[type]} ${isVisible ? styles.visible : ''} ${isLeaving ? styles.leaving : ''}`}
            role="alert"
        >
            <div className={styles.iconWrapper}>
                <Icon />
            </div>
            <p className={styles.message}>{message}</p>
            <button type="button" className={styles.closeButton} onClick={handleClose} aria-label="Dismiss">
                <CloseIcon />
            </button>
            <div className={styles.progressTrack}>
                <div
                    className={styles.progressBar}
                    style={{ animationDuration: `${duration}ms` }}
                />
            </div>
        </div>
    );
};
