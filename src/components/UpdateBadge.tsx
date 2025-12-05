import { useLiveryStore } from '@/store/liveryStore';
import styles from './UpdateBadge.module.css';

export const UpdateBadge = () => {
    const availableUpdates = useLiveryStore((state) => state.availableUpdates);
    
    if (availableUpdates.length === 0) {
        return null;
    }

    return (
        <span className={styles.badge} title={`${availableUpdates.length} update${availableUpdates.length === 1 ? '' : 's'} available`}>
            {availableUpdates.length}
        </span>
    );
};
