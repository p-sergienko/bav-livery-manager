import React from 'react';
import styles from './StatusBar.module.css';

interface StatusBarProps {
    messages: Array<{ type?: 'info' | 'error' | 'success'; text: string }>;
}

export const StatusBar: React.FC<StatusBarProps> = ({ messages }) => {
    if (!messages.length) return null;
    return (
        <div className={styles.bar} aria-live="polite">
            {messages.map((msg, idx) => (
                <div key={idx} className={msg.type === 'error' ? styles.error : msg.type === 'success' ? styles.success : styles.info}>
                    {msg.text}
                </div>
            ))}
        </div>
    );
};
