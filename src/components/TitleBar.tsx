import React from 'react';
import styles from './TitleBar.module.css';
import {BAVIcon} from "@/components/Icons/BAVIcon";

export const TitleBar: React.FC = () => {
    const isMac = navigator.userAgent.toLowerCase().includes('mac');

    return (
        <div className={`${styles.titleBar}`}>
            <div className={styles.logoContainer}>
                <BAVIcon height={26} width={26} />
                <span className={styles.title}>BAVirtual Livery Manager</span>
            </div>
        </div>
    );
};
