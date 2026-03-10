import { useLiveryStore } from "@/store/liveryStore";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import ReturnButton from "@/components/ReturnButton";


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
            <h1>{selectedLivery.name}</h1>
            <p>This is the information page of the livery with ID: {liveryId}.</p>
        </div>
    );
}