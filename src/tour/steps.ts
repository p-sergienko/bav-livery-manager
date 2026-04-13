import type { PopperPlacement } from "shepherd.js";

export interface TourStepDef {
    element: string;
    title: string;
    text: string;
    placement: PopperPlacement;
    route?: string;
}

export const MAIN_TOUR_STEPS: TourStepDef[] = [
    {
        element: "#simDirectorySection",
        title: "Sim directories",
        text: `<video autoplay loop muted playsinline><source src="/guides/filterSection.webm" type="video/webm"></video>`,
        placement: "bottom",
        route: "/settings",
    },
    {
        element: "#filterSection",
        title: "Search & Filtering",
        text: `<video autoplay loop muted playsinline><source src="/guides/filterSection.webm" type="video/webm"></video>`,
        placement: "bottom",
        route: "/search",
    },
    {
        element: "#filters",
        title: "Filtering",
        text: `<video autoplay loop muted playsinline><source src="/guides/filtering.webm" type="video/webm"></video>`,
        placement: "bottom",
        route: "/search",
    },
    {
        element: "#simulatorResolutionSelect",
        title: "Select Simulator & Resolution",
        text: "Navigate between sections",
        placement: "bottom-start",
        route: "/search",
    },
];
