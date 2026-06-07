export function CheckboxChecked() {
    return (
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <rect x="1" y="1" width="14" height="14" rx="3" fill="var(--accent)" />
            <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function CheckboxEmpty() {
    return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" stroke="var(--border-strong)" strokeWidth="1.5" />
        </svg>
    );
}
