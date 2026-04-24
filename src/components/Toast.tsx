import { useEffect, useState } from 'react';
import type React from 'react';
import styles from './Toast.module.css';
import {AlertCircle, AlertTriangle, Info, Smile, X} from "react-feather";

export interface ToastProps {
    message: React.ReactNode;
    type?: 'error' | 'success' | 'info' | 'warning';
    duration?: number;
    onClose: () => void;
}

const CloseIcon = () => <X/>;

const ErrorIcon = () => <AlertCircle/>;

const SuccessIcon = () => <Smile/>;

const InfoIcon = () => <Info/>;

const WarningIcon = () => <AlertTriangle/>;

const iconMap = {
    error: ErrorIcon,
    success: SuccessIcon,
    info: InfoIcon,
    warning: WarningIcon
};

export const Toast = ({ message, type = 'error', duration = 6000, onClose }: ToastProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    useEffect(() => {
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
        }, 300);
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
