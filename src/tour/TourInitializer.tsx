import { useEffect } from "react";
import { useTourStore } from "@/store/tourStore";
import { TourWelcomeModal } from "@/tour/TourWelcomeModal";

export function TourInitializer() {
    const hasSeenTour = useTourStore((s) => s.hasSeenTour);
    const openWelcome = useTourStore((s) => s.openWelcome);
    const stopTour    = useTourStore((s) => s.stopTour);

    useEffect(() => {
        if (!hasSeenTour) {
            const timer = setTimeout(() => openWelcome(), 500);
            return () => clearTimeout(timer);
        }
    }, []);

    useEffect(() => {
        const handleLinkClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const a = target.closest('a');
            if (a && a.href && (a.href.startsWith('http://') || a.href.startsWith('https://')) && a.closest('.shepherd-element')) {
                e.preventDefault();
                window.electronAPI?.openExternalLink(a.href);
            }
        };

        document.addEventListener('click', handleLinkClick);
        return () => {
            stopTour();
            document.removeEventListener('click', handleLinkClick);
        };
    }, []);

    return <TourWelcomeModal />;
}