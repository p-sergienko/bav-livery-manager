import { useLiveryStore } from "@/store/liveryStore";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import ReturnButton from "@/components/ReturnButton";
import styles from "@/pages/InformationPage.module.css"

const DeveloperLogo = ({ developerName }: { developerName: string }) => {
    const logoSrc = `public/${developerName}.png`;
    return <img src={logoSrc} alt={`${developerName} logo`} />;
};

export function InformationPage() {
    const { liveryId } = useParams();

    const { liveries } = useLiveryStore();

    const selectedLivery = useMemo(() => {
        return liveries.find(livery => livery.id === liveryId)
    }, [liveries, liveryId]);


    // TODO: Show the error

    if (!selectedLivery) {
        return (
            <>
                NOTHING !!!
            </>
        )
    }

    return (
        <div className="information-page">
            <div className="returnButton">
                <ReturnButton />
            </div>
            <div className={styles.headerSection}>
                <div className={styles.textContainer}>
                    <h1>{selectedLivery.name}</h1>
                    <h3>
                        {selectedLivery.aircraftProfileName} | {selectedLivery.categoryName} |{" "}
                        {selectedLivery.engine} | {selectedLivery.year}
                    </h3>
                </div>
                <div className={styles.devLogo}>
                    <DeveloperLogo developerName={selectedLivery.developerName} />
                </div>
            </div>
            <div className={styles.mainBody}>
                <div className={styles.changesBox}>
                    {/* Add livery details here – description, download link, etc. */}
                    <p>Description</p>
                </div> 
                <div className={styles.liveryBox}>
                    <div className={styles.imageContainer}>
                        <img src={selectedLivery.preview ?? ""} alt={`${selectedLivery.name} preview`} loading="lazy" />
                    </div>
                </div>                    
            </div>
        </div>
    );
}