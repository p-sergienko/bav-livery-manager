import type { PopperPlacement } from "shepherd.js";

export interface TourStepDef {
    element: string;
    title: string;
    text: string;
    placement: PopperPlacement;
}

export const MAIN_TOUR_STEPS: TourStepDef[] = [
    {
        element: "#filterSection",
        title: "Search & Filtering",
        text: `<video autoplay loop muted playsinline><source src="/guides/filterSection.webm" type="video/webm"></video>`,
        placement: "bottom",
    },
    {
        element: "#filters",
        title: "Filtering",
        text: `<video autoplay loop muted playsinline><source src="/guides/filtering.webm" type="video/webm"></video>`,
        placement: "bottom",
    },
    {
        element: "#simulatorResolutionSelect",
        title: "Select Simulator & Resolution",
        text: "Navigate between sections",
        placement: "bottom-start",
    },
];
