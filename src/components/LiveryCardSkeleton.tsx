import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import styles from './LiveryCard.module.css';

export const LiveryCardSkeleton = () => {
    return (
        <article className={styles.card} aria-hidden="true">
            <div className={styles.imageContainer}>
                <Skeleton height="100%" borderRadius={0} style={{ position: 'absolute', inset: 0 }} />
            </div>

            <div className={styles.content}>
                <div className={styles.titleRow}>
                    <div style={{ flex: 1 }}>
                        <p className={styles.developer}><Skeleton width={80} /></p>
                        <h3 className={styles.title} style={{ marginTop: 6 }}><Skeleton width="70%" /></h3>
                    </div>
                </div>

                <dl className={styles.meta} style={{ marginTop: 8 }}>
                    <div>
                        <dt className={styles.metaLabel}><Skeleton width={50} /></dt>
                        <dd className={styles.metaValue}><Skeleton width={70} /></dd>
                    </div>
                    <div>
                        <dt className={styles.metaLabel}><Skeleton width={60} /></dt>
                        <dd className={styles.metaValue}><Skeleton width={80} /></dd>
                    </div>
                    <div>
                        <dt className={styles.metaLabel}><Skeleton width={45} /></dt>
                        <dd className={styles.metaValue}><Skeleton width={60} /></dd>
                    </div>
                </dl>
                
                <dl className={styles.metaSecond}>
                    <div>
                        <dt className={styles.metaLabel}><Skeleton width={40} /></dt>
                        <dd className={styles.metaValue}><Skeleton width={50} /></dd>
                    </div>
                    <div>
                        <dt className={styles.metaLabel}><Skeleton width={60} /></dt>
                        <dd className={styles.metaValue}><Skeleton width={90} /></dd>
                    </div>
                </dl>

                <div className={styles.downloadRow}>
                    <div className={styles.downloadChip}>
                        <Skeleton height={36} borderRadius={8} />
                    </div>
                </div>
            </div>
        </article>
    );
};

