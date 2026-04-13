import { useTourStore } from "@/store/tourStore";
import { MAIN_TOUR_STEPS } from "./steps";
import type { TourStepDef } from "./steps";

export function useTour(customSteps?: TourStepDef[]) {
    const steps = customSteps ?? MAIN_TOUR_STEPS;

    const isActive     = useTourStore((s) => s.isActive);
    const currentStep  = useTourStore((s) => s.currentStep);
    const totalSteps   = useTourStore((s) => s.totalSteps);
    const hasSeenTour  = useTourStore((s) => s.hasSeenTour);
    const startTour    = useTourStore((s) => s.startTour);
    const stopTour     = useTourStore((s) => s.stopTour);
    const nextStep     = useTourStore((s) => s.nextStep);
    const prevStep     = useTourStore((s) => s.prevStep);
    const moveTo       = useTourStore((s) => s.moveTo);
    const resetTour    = useTourStore((s) => s.resetTour);

    return {
        isActive,
        currentStep,
        totalSteps,
        hasSeenTour,
        startTour: () => startTour(steps),
        stopTour,
        nextStep,
        prevStep,
        moveTo,
        resetTour,
    };
}
