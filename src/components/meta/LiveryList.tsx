import { useState } from 'react';
import { useMetaManifestStore } from '@/store/metaManifestStore';
import styles from './LiveryList.module.css';

export function MetaLiveryList() {
    const { liveries, selectedIds, toggleSelect, selectAll, selectNone, removeLivery } = useMetaManifestStore();
    const [search, setSearch] = useState('');

    const filtered = search.trim()
        ? liveries.filter(
              (l) =>
                  l.dirName.toLowerCase().includes(search.toLowerCase()) ||
                  (l.manifest.title as string | undefined)?.toLowerCase().includes(search.toLowerCase())
          )
        : liveries;

    return (
        <aside className={styles.sidebar}>
            <div className={styles.header}>
                <span className={styles.title}>Liveries</span>
                <span className={styles.count}>{liveries.length}</span>
            </div>

            <div className={styles.searchBar}>
                <input
                    className={styles.searchInput}
                    type="text"
                    placeholder="Search…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                    <button className={styles.clearBtn} onClick={() => setSearch('')}>×</button>
                )}
            </div>

            {liveries.length > 0 && (
                <div className={styles.selectionBar}>
                    <button className={styles.linkBtn} onClick={selectAll}>All</button>
                    <span className={styles.divider}>·</span>
                    <button className={styles.linkBtn} onClick={selectNone}>None</button>
                    <span className={styles.selectedCount}>
                        {selectedIds.size > 0 && `${selectedIds.size} selected`}
                    </span>
                </div>
            )}

            <ul className={styles.list}>
                {filtered.map((livery) => {
                    const isSelected = selectedIds.has(livery.id);
                    return (
                        <li
                            key={livery.id}
                            className={`${styles.item} ${isSelected ? styles.itemSelected : ''} ${livery.loadError ? styles.itemError : ''}`}
                            onClick={() => toggleSelect(livery.id)}
                        >
                            <span className={styles.checkbox}>
                                {isSelected ? (
                                    <svg viewBox="0 0 16 16" fill="currentColor">
                                        <rect x="1" y="1" width="14" height="14" rx="3" className={styles.checkboxRect} />
                                        <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                ) : (
                                    <svg viewBox="0 0 16 16" fill="none">
                                        <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" className={styles.checkboxEmpty} />
                                    </svg>
                                )}
                            </span>
                            <span className={styles.itemContent}>
                                <span className={styles.dirName} title={livery.dirPath}>{livery.dirName}</span>
                                {livery.manifest.title && livery.manifest.title !== livery.dirName && (
                                    <span className={styles.manifestTitle}>{livery.manifest.title as string}</span>
                                )}
                                {livery.loadError && <span className={styles.errorBadge}>No manifest</span>}
                                {livery.hasChanges && !livery.loadError && <span className={styles.changeBadge}>●</span>}
                            </span>
                            <button
                                className={styles.removeBtn}
                                title="Remove from list"
                                onClick={(e) => { e.stopPropagation(); removeLivery(livery.id); }}
                            >
                                ×
                            </button>
                        </li>
                    );
                })}
                {filtered.length === 0 && liveries.length > 0 && (
                    <li className={styles.noResults}>No matches for "{search}"</li>
                )}
            </ul>

            {liveries.length === 0 && (
                <div className={styles.empty}><span>No liveries added yet</span></div>
            )}
        </aside>
    );
}
