import { useLiveryStore } from '@/store/liveryStore';
import { usePackageStore } from '@/store/packageStore';
import styles from './UpdateBadge.module.css';

export const UpdateBadge = () => {
    const liveryUpdates = useLiveryStore((state) => state.availableUpdates);
    const packageUpdates = usePackageStore((state) => state.availableUpdates);
    const total = liveryUpdates.length + packageUpdates.length;

    if (total === 0) {
        return null;
    }

    return (
        <span className={styles.badge} title={`${total} update${total === 1 ? '' : 's'} available`}>
            {total} update{total === 1 ? '' : 's'}
        </span>
    );
};
