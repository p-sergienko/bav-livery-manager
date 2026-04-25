import {useMemo} from 'react';
import styles from './Pagination.module.css';

interface Props {
    currentPage: number;
    totalPages: number;
    startItem: number;
    endItem: number;
    total: number;
    loading?: boolean;
    onJump: (page: number) => void;
}

const ChevronLeft = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 18l-6-6 6-6"/>
    </svg>
);

const ChevronRight = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 18l6-6-6-6"/>
    </svg>
);

const cn = (...tokens: Array<string | false | undefined>) => tokens.filter(Boolean).join(' ');

export const Pagination = ({currentPage, totalPages, startItem, endItem, total, loading, onJump}: Props) => {
    const pageNumbers = useMemo(() => {
        const pages: Array<number | 'ellipsis'> = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            if (start > 2) pages.push('ellipsis');
            for (let i = start; i <= end; i++) pages.push(i);
            if (end < totalPages - 1) pages.push('ellipsis');
            pages.push(totalPages);
        }
        return pages;
    }, [currentPage, totalPages]);

    const countLabel = (() => {
        if (total > 0) return <span className={styles.count}>Showing <strong>{startItem}–{endItem}</strong> of <strong>{total}</strong></span>;
        if (loading) return <span className={styles.count}>Loading liveries…</span>;
        return <span className={styles.count}>No results</span>;
    })();

    return (
        <div className={styles.bar} role="navigation" aria-label="Pagination">
            {countLabel}
            {totalPages > 1 && (
                <div className={styles.nav}>
                    <button
                        type="button"
                        className={styles.arrow}
                        onClick={() => onJump(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        aria-label="Previous page"
                    >
                        <ChevronLeft/>
                    </button>

                    <div className={styles.pages}>
                        {pageNumbers.map((p, i) =>
                            p === 'ellipsis' ? (
                                <span key={`e${i}`} className={styles.ellipsis}>…</span>
                            ) : (
                                <button
                                    key={p}
                                    type="button"
                                    className={cn(styles.page, p === currentPage && styles.pageActive)}
                                    onClick={() => p !== currentPage && onJump(p)}
                                    aria-label={`Page ${p}`}
                                    aria-current={p === currentPage ? 'page' : undefined}
                                >
                                    {p}
                                </button>
                            )
                        )}
                    </div>

                    <button
                        type="button"
                        className={styles.arrow}
                        onClick={() => onJump(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        aria-label="Next page"
                    >
                        <ChevronRight/>
                    </button>
                </div>
            )}
        </div>
    );
};
