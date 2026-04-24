import {useEffect, useRef} from 'react';
import styles from './SearchBar.module.css';

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    resultCount?: number;
    totalCount?: number;
    loading?: boolean;
}

const SearchIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M11 3a8 8 0 0 1 8 8c0 1.848-.627 3.55-1.68 4.905l3.386 3.388a1 1 0 0 1-1.414 1.414l-3.388-3.386A7.96 7.96 0 0 1 11 19a8 8 0 1 1 0-16z"/>
    </svg>
);

const CloseIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
);

export const SearchBar = ({value, onChange, resultCount, totalCount, loading}: SearchBarProps) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
                inputRef.current?.select();
            }
            if (e.key === 'Escape' && document.activeElement === inputRef.current) {
                onChange('');
                inputRef.current?.blur();
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onChange]);

    const showCount = value.trim().length > 0 && resultCount !== undefined && totalCount !== undefined;
    const hasNarrowed = showCount && resultCount !== totalCount;

    return (
        <div className={styles.wrap}>
            <div className={styles.inputRow}>
                <span className={styles.icon}><SearchIcon/></span>
                <input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Search — try combining terms like Euroflyer A320"
                    className={styles.input}
                    type="search"
                    autoComplete="off"
                    spellCheck={false}
                />
                {value ? (
                    <button
                        type="button"
                        className={styles.clear}
                        onClick={() => { onChange(''); inputRef.current?.focus(); }}
                        aria-label="Clear search"
                    >
                        <CloseIcon/>
                    </button>
                ) : (
                    <kbd className={styles.shortcut}>Ctrl K</kbd>
                )}
            </div>
            {showCount && (
                <div className={`${styles.hint} ${hasNarrowed ? styles.hintActive : ''}`}>
                    {loading ? (
                        <span>Searching…</span>
                    ) : hasNarrowed ? (
                        <span><strong>{resultCount}</strong> of {totalCount} match</span>
                    ) : (
                        <span>All {totalCount} match</span>
                    )}
                </div>
            )}
        </div>
    );
};
