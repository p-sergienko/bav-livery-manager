import { create } from "zustand";
import { persist } from "zustand/middleware";
import Shepherd from "shepherd.js";
import type { Tour, Step, StepOptions } from "shepherd.js";

const ShepherdTour = Shepherd.Tour;
import type { TourStepDef } from "@/tour/steps";

let tour: Tour | null = null;

function buildStepOptions(
    stepDef: TourStepDef,
    index: number,
    total: number,
    syncStep: (i: number) => void,
): StepOptions {
    const isFirst = index === 0;
    const isLast = index === total - 1;

    return {
        id: `step-${index}`,
        title: stepDef.title,
        text: stepDef.text,
        attachTo: { element: stepDef.element, on: stepDef.placement },
        cancelIcon: { enabled: true },
        scrollTo: { behavior: "smooth", block: "center" },
        modalOverlayOpeningPadding: 4,
        modalOverlayOpeningRadius: 4,
        beforeShowPromise: stepDef.route ? function() {
            return new Promise<void>((resolve) => {
                const targetHash = `#${stepDef.route}`;

                if (!window.location.hash.startsWith(targetHash)) {
                    window.location.hash = targetHash;
                }

                let attempts = 0;
                const checkElement = () => {
                    const el = document.querySelector(stepDef.element);
                    if (el) {
                        setTimeout(resolve, 100);
                    } else if (attempts < 20) {
                        attempts++;
                        setTimeout(checkElement, 50);
                    } else {
                        resolve();
                    }
                };
                
                checkElement();
            });
        } : undefined,
        buttons: [
            ...(!isFirst
                ? [{ text: "← Back", secondary: true, action(this: Tour) { this.back(); } }]
                : []),
            {
                text: isLast ? "Finish" : "Next →",
                action(this: Tour) { isLast ? this.complete() : this.next(); },
            },
        ],
        when: {
            show(this: Step) {
                const idx = this.tour.steps.indexOf(this);
                syncStep(idx);

                const footer = this.el?.querySelector(".shepherd-footer");
                if (!footer) return;
                let prog = footer.querySelector<HTMLElement>(".shepherd-progress");
                if (!prog) {
                    prog = document.createElement("span");
                    prog.className = "shepherd-progress";
                    footer.insertBefore(prog, footer.firstChild);
                }
                prog.textContent = `${idx + 1} of ${this.tour.steps.length}`;
            },
        },
    };
}

interface TourState {
    hasSeenTour: boolean;
    isActive: boolean;
    isWelcomeOpen: boolean;
    currentStep: number;
    totalSteps: number;
}

interface TourActions {
    openWelcome: () => void;
    acceptTour: (steps: TourStepDef[]) => void;
    declineTour: () => void;
    startTour: (steps: TourStepDef[]) => void;
    stopTour: () => void;
    resetTour: () => void;
    nextStep: () => void;
    prevStep: () => void;
    moveTo: (index: number) => void;
    _syncStep: (index: number) => void;
    _onTourEnd: () => void;
}

export const useTourStore = create<TourState & TourActions>()(
    persist(
        (set, get) => ({
            hasSeenTour: false,
            isActive: false,
            isWelcomeOpen: false,
            currentStep: 0,
            totalSteps: 0,

            openWelcome: () => set({ isWelcomeOpen: true }),

            acceptTour: (steps) => {
                set({ isWelcomeOpen: false, hasSeenTour: true });
                setTimeout(() => get().startTour(steps), 400);
            },

            declineTour: () => {
                set({ isWelcomeOpen: false, hasSeenTour: true });
            },

            startTour: (steps) => {
                const t = tour;
                tour = null;
                t?.cancel();

                tour = new ShepherdTour({ useModalOverlay: true });

                steps.forEach((stepDef, i) => {
                    tour!.addStep(buildStepOptions(stepDef, i, steps.length, get()._syncStep));
                });

                tour.on("cancel", () => get()._onTourEnd());
                tour.on("complete", () => get()._onTourEnd());

                set({ isActive: true, currentStep: 0, totalSteps: steps.length });
                tour.start();
            },

            stopTour: () => {
                const t = tour;
                tour = null;
                t?.cancel();
                set({ isActive: false, currentStep: 0 });
            },

            resetTour: () => {
                const t = tour;
                tour = null;
                t?.cancel();
                set({ hasSeenTour: false, isActive: false, currentStep: 0 });
            },

            nextStep: () => { tour?.next(); },
            prevStep: () => { tour?.back(); },
            moveTo: (index) => { tour?.show(`step-${index}`); },

            _syncStep: (index) => set({ currentStep: index }),

            _onTourEnd: () => {
                tour = null;
                set({ isActive: false, currentStep: 0 });
            },
        }),
        {
            name: "tour-storage",
            partialize: (state) => ({ hasSeenTour: state.hasSeenTour }),
        }
    )
);
