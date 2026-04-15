import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import styles from './DownloadedLiveryCard.module.css';

export const DownloadedLiveryCardSkeleton = () => {
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

                <div className={styles.meta} style={{ marginTop: 8, marginBottom: 12 }}>
                    <div>
                        <div className={styles.metaLabel}><Skeleton width={50} /></div>
                        <div className={styles.metaValue}><Skeleton width={70} /></div>
                    </div>
                    <div>
                        <div className={styles.metaLabel}><Skeleton width={60} /></div>
                        <div className={styles.metaValue}><Skeleton width={80} /></div>
                    </div>
                    <div>
                        <div className={styles.metaLabel}><Skeleton width={45} /></div>
                        <div className={styles.metaValue}><Skeleton width={60} /></div>
                    </div>
                </div>

                <div className={styles.updateInfo}>
                    <Skeleton width="40%" />
                    <Skeleton width="80%" />
                </div>

                <div className={styles.actions} style={{ marginTop: 10 }}>
                    <Skeleton height={36} borderRadius={8} style={{ flex: 1 }} />
                    <Skeleton height={36} borderRadius={8} style={{ flex: 1 }} />
                </div>
            </div>
        </article>
    );
};

