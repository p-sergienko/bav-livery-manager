import { useState, useMemo } from 'react';
import Markdown from 'react-markdown';
import styles from './Changelog.module.css';

interface ChangelogEntry {
    version: string;
    content: string;
    releaseDate?: string;
}

const changelogModules = import.meta.glob('/changelogs/*.md', {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>;

function extractReleaseDate(content: string): string | undefined {
    const match = content.match(/\*\*Released:\*\*\s*(.+)/);
    return match?.[1]?.trim();
}

/** Strip the top-level `# vX.Y.Z` heading and the `**Released:** …` line so the
 *  accordion header handles that info instead of duplicating it in the body. */
function stripHeaderMeta(content: string): string {
    return content
        .replace(/^#\s+v[\d.]+[^\n]*\n*/m, '')
        .replace(/\*\*Released:\*\*[^\n]*\n*/m, '')
        .trim();
}

function parseChangelogs(): ChangelogEntry[] {
    const entries: ChangelogEntry[] = [];

    for (const [filePath, raw] of Object.entries(changelogModules)) {
        const match = filePath.match(/\/(v[\d.]+(?:-[a-zA-Z0-9.]+)?)\.md$/);
        if (match) {
            entries.push({
                version: match[1],
                content: stripHeaderMeta(raw),
                releaseDate: extractReleaseDate(raw),
            });
        }
    }

    return entries.sort((a, b) => {
        const aParts = a.version.replace('v', '').split('.').map(Number);
        const bParts = b.version.replace('v', '').split('.').map(Number);
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const diff = (bParts[i] || 0) - (aParts[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    });
}

const mdComponents = {
    h1: ({ children }: any) => <h3 className={styles.mdH1}>{children}</h3>,
    h2: ({ children }: any) => <h4 className={styles.mdH2}>{children}</h4>,
    h3: ({ children }: any) => <h4 className={styles.mdH3}>{children}</h4>,
    p: ({ children }: any) => <p className={styles.mdP}>{children}</p>,
    ul: ({ children }: any) => <ul className={styles.mdUl}>{children}</ul>,
    ol: ({ children }: any) => <ol className={styles.mdOl}>{children}</ol>,
    li: ({ children }: any) => <li className={styles.mdLi}>{children}</li>,
    strong: ({ children }: any) => <strong className={styles.mdStrong}>{children}</strong>,
    em: ({ children }: any) => <em className={styles.mdEm}>{children}</em>,
    code: ({ children, className }: any) => {
        const isBlock = className?.includes('language-');
        return isBlock
            ? <code className={`${styles.mdCode} ${styles.mdCodeBlock}`}>{children}</code>
            : <code className={styles.mdCode}>{children}</code>;
    },
    pre: ({ children }: any) => <pre className={styles.mdPre}>{children}</pre>,
    a: ({ href, children }: any) => (
        <a className={styles.mdA} href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    ),
    hr: () => <hr className={styles.mdHr} />,
    blockquote: ({ children }: any) => <blockquote className={styles.mdBlockquote}>{children}</blockquote>,
};

export const Changelog = () => {
    const entries = useMemo(() => parseChangelogs(), []);
    const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

    if (entries.length === 0) {
        return (
            <div className={styles.container}>
                <p className={styles.empty}>No changelog entries found.</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {entries.map((entry) => {
                const isExpanded = expandedVersion === entry.version;
                return (
                    <div key={entry.version} className={`${styles.entry} ${isExpanded ? styles.entryExpanded : ''}`}>
                        <button
                            type="button"
                            className={`${styles.entryHeader} ${isExpanded ? styles.entryHeaderExpanded : ''}`}
                            onClick={() =>
                                setExpandedVersion(isExpanded ? null : entry.version)
                            }
                        >
                            <div className={styles.entryVersion}>
                                <span className={styles.versionTag}>{entry.version}</span>
                            </div>
                            <svg
                                className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ''}`}
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                            >
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>

                        {isExpanded && (
                            <div className={styles.entryContent}>
                                <Markdown components={mdComponents}>
                                    {entry.content}
                                </Markdown>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
