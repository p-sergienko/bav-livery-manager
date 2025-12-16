import styles from "./ApplicationUpdateBadge.module.css";
import { useAppUpdateStore } from "@/store/updateStore";

export const ApplicationUpdateBadge = () => {

    const { updateAvailable, updateInfo } = useAppUpdateStore();

    if (!updateAvailable && !updateInfo) {
        return null;
    }

    return (
        <div className={styles.badge}>
            Update {updateInfo?.version ? `v${updateInfo?.version}` : "the app"}
        </div>
    )
}