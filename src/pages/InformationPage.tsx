import { useLiveryStore } from "@/store/liveryStore";
import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ReturnButton } from "@/components/ReturnButton";
import styles from "@/pages/InformationPage.module.css"

const classNames = (...tokens: Array<string | false>) => tokens.filter(Boolean).join(' ');

export function InformationPage() {
    const { liveryId } = useParams();

    const { liveries } = useLiveryStore();

    const [selectedSimulator, setSelectedSimulator] = useState<"fs20" | "fs24">("fs24");

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

    const logoSrc = `${selectedLivery.developerName}.png`;

    const liveryRegistration = selectedLivery.name.split(" ")[0];

    const flightRadarUrl = `https://www.flightradar24.com/data/aircraft/${liveryRegistration}`;
    const airNavRadarUrl = `https://www.airnavradar.com/data/registration/${liveryRegistration}`;
    const planeSpottersUrl = `https://www.planespotters.net/photos/reg/${liveryRegistration}`;

    const openWebsite = (url: string) => {
        const api = window.electronAPI;
        if (!api?.openPanelAuth || url === "") {
            return;
        }

        api.openPanelAuth(url);
        return;
    };

    return (
        <div className={styles.informationPage}>
            <div className={styles.informationPageControls}>
                <ReturnButton />
                <div className={styles.simulatorButtonsGroup}>
                    <button className={selectedSimulator == "fs20" ? styles.active : ""} onClick={() => setSelectedSimulator("fs20")}>
                        MSFS 2020
                    </button>
                    <button className={selectedSimulator == "fs24" ? styles.active : ""} onClick={() => setSelectedSimulator("fs24")}>
                        MSFS 2024
                    </button>
                </div>
            </div>
            <div className={styles.headerSection}>
                <div className={styles.textContainer}>
                    <div className={styles.logoAndTitle}>
                        <img className={styles.devLogo} src={logoSrc} alt={`${selectedLivery.developerName} logo`} />
                        <h1>{selectedLivery.name}</h1>
                    </div>
                    <h3>
                        {selectedLivery.aircraftProfileName} | {selectedLivery.engine} | {selectedLivery.categoryName}
                    </h3>
                </div>
                <div className={styles.downloadContainer}>
                    <div className={styles.downloadButtonsGrouo}>
                        <button className={styles.downloadButton}>
                            <h4>Download 4K</h4>
                            <p>202.15 MB</p>
                        </button>
                        <button className={styles.downloadButton}>
                            <h4>Download 8K</h4>
                            <p>2802.15 MB</p>
                        </button>
                    </div>
                    <p>Select the simulator in the top right corner.</p>
                </div>
            </div>
            <div className={styles.mainBody}>
                <div className={styles.informationContainer}>
                    <p>Airframe details:</p>
                    <div className={styles.factsSheet}>
                        <dl>
                            <div>
                                <dt className={styles.metaLabel}>Registration</dt>
                                <dd className={styles.metaValue}>{liveryRegistration}</dd>
                            </div>
                            <div>
                                <dt className={styles.metaLabel}>MSN / Serial</dt>
                            </div>
                            <div>
                                <dt className={styles.metaLabel}>SELCAL</dt>
                            </div>
                            <div>
                                <dt className={styles.metaLabel}>Mode-S</dt>
                            </div>
                        </dl>
                        <dl>
                            <div>
                                <dt className={styles.metaLabel}>Manufacturer</dt>
                            </div>
                            <div>
                                <dt className={styles.metaLabel}>Year Built</dt>
                                <dd className={styles.metaValue}>{selectedLivery.year ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className={styles.metaLabel}>Delivery Date</dt>
                            </div>
                            <div>
                                <dt className={styles.metaLabel}>Livery Name</dt>
                            </div>
                        </dl>
                    </div>
                    <div className={styles.buttonsContainer}>
                        <div className={styles.radarButtonsGroup}>
                            <button className={styles.radarButton} onClick={() => openWebsite(flightRadarUrl)}>
                                <img className={styles.radarIcon} src="flightradar24.webp" alt="flightradar24 icon" />
                                FlightRadar24
                            </button>
                            <button className={styles.radarButton} onClick={() => openWebsite(airNavRadarUrl)}>
                                <img className={styles.radarIcon} src="airnavradar.webp" alt="airnavradar icon" />
                                AirNavRadar
                            </button>
                        </div>
                        <button className={styles.radarButton} onClick={() => openWebsite(planeSpottersUrl)}>
                            <img className={styles.radarIcon} src="planespotters.webp" alt="planespotters icon" />
                            PlaneSpotters
                        </button>
                    </div>
                </div>
                <div className={styles.liveryBox}>
                    <img className={styles.liveryPreview} src={selectedLivery.preview ?? ""} alt={`${selectedLivery.name} preview`} loading="lazy" />
                </div>
            </div>
            <div className={styles.secondaryBody}>
                <div className={styles.informationContainer}>
                    <p className={styles.changelogHeader}>Livery Changelog:</p>
                    <div className={styles.changelog}>
                        <div className={styles.changelogEntry}>
                            <h4>Version: v1.0.0 <span>(Current)</span></h4>
                            <p>
                                - Initial release
                            </p>
                            <p>
                                - Added support for 10 liveries
                            </p>
                            <h5>20 June 2027 - 230.03MB</h5>
                        </div>
                        <div className={styles.changelogEntry}>
                            <h4>Version: v1.0.0 <span>(Current)</span></h4>
                            <p>
                                - Initial release
                            </p>
                            <p>
                                - Added support for 10 liveries
                            </p>
                            <h5>20 June 2027 - 230.03MB</h5>
                        </div>
                        <div className={styles.changelogEntry}>
                            <h4>Version: v1.0.0 <span>(Current)</span></h4>
                            <p>
                                - Initial release
                            </p>
                            <p>
                                - Added support for 10 liveries
                            </p>
                            <h5>20 June 2027 - 230.03MB</h5>
                        </div>
                        <div className={styles.changelogEntry}>
                            <h4>Version: v1.0.0 <span>(Current)</span></h4>
                            <p>
                                - Initial release
                            </p>
                            <p>
                                - Added support for 10 liveries
                            </p>
                            <h5>20 June 2027 - 230.03MB</h5>
                        </div>
                        <div className={styles.changelogEntry}>
                            <h4>Version: v1.0.0 <span>(Current)</span></h4>
                            <p>
                                - Initial release
                            </p>
                            <p>
                                - Added support for 10 liveries
                            </p>
                            <h5>20 June 2027 - 230.03MB</h5>
                        </div>
                        <div className={styles.changelogEntry}>
                            <h4>Version: v1.0.0 <span>(Current)</span></h4>
                            <p>
                                - Initial release
                            </p>
                            <p>
                                - Added support for 10 liveries
                            </p>
                            <h5>20 June 2027 - 230.03MB</h5>
                        </div>
                    </div>
                </div>
                <div className={styles.informationContainer}>
                    123
                </div>
            </div>
        </div>
    );
}