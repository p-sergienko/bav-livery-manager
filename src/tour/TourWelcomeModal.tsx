import { useTourStore } from "@/store/tourStore";
import { MAIN_TOUR_STEPS } from "@/tour/steps";
import styles from "./TourWelcomeModal.module.css";
import { useAuthStore } from "@/store/authStore";
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { useEffect } from "react";
import Fade from 'embla-carousel-fade';
import { BAVIcon } from "@/components/Icons/BAVIcon";

const SlidesDescriptions = [
    {
        image: "/slides/slide1.webp",
        title: "A380 arrives in Anchorage",
        author: "Laurie Cooper BAW6"
    },
    {
        image: "/slides/slide2.webp",
        title: "BLA BLA BLA G-EUUB",
        author: "BAW66 Laurie Cooooooper"
    },
    {
        image: "/slides/slide3.webp",
        title: "BAL BAL BAL G-EUUC",
        author: "BAW666 Laurie Coooooooooooooooper"
    }
]

export function TourWelcomeModal() {
    const isWelcomeOpen = useTourStore((s) => s.isWelcomeOpen);
    const acceptTour = useTourStore((s) => s.acceptTour);
    const declineTour = useTourStore((s) => s.declineTour);

    const { fullName } = useAuthStore();

    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false }, [Autoplay({ delay: 5000 }), Fade()]);

    useEffect(() => {
        if (!emblaApi) return
        emblaApi.plugins().autoplay?.play()
    }, [emblaApi]);

    if (!isWelcomeOpen) return null;

    return (
        <div className={styles.backdrop}>
            <div className={styles.modal}>
                <div>
                    <div className="embla">
                        <div className="embla__viewport" ref={emblaRef}>
                            <div className="embla__container">
                                {SlidesDescriptions.map((slide, index) => (
                                    <div key={index} className="embla__slide">
                                        <img className={styles.slide} src={slide.image} alt={`Slide ${index + 1}`} />
                                        <div className={styles.slideGradient} />
                                        <div className={styles.slideDescription}>
                                            <div className={styles.slideText}>
                                                <h3>{slide.title}</h3>
                                                <p>{slide.author}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.content}>
                    <div className={styles.header}>
                        <div className={styles.logo}>
                            <BAVIcon width={40} height={40} />
                            <h2>Livery Manager</h2>
                        </div>
                        <div className={styles.subHeader}>
                            <p>Manage your British Airways liveries</p>
                        </div>
                    </div>
                    <div className={styles.body}>
                        <h2 className={styles.title}>Hey, {fullName || "pilot"}!</h2>
                        <p className={styles.description}>
                            Looks like it's your first time here. Would you like a quick tour
                            to get familiar with the app?
                        </p>
                    </div>
                    <div className={styles.actions}>
                        <button className={styles.btnSecondary} onClick={declineTour}>
                            Skip for now
                        </button>
                        <button
                            className={styles.btnPrimary}
                            onClick={() => acceptTour(MAIN_TOUR_STEPS)}
                        >
                            Show me around →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}