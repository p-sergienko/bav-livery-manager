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
        title: "Select your directories for each simulator here",
        text: "<br/>The <strong>Auto-detect paths button</strong> can find the default simulator locations. Alternatively, a custom directory can be <strong>set manually</strong>.<br/><br/>Tip: Do not forget to save the settings.",
        placement: "bottom",
        route: "/settings",
    },
    {
        element: "#filterSection",
        title: "Find desired liveries using the search function",
        text: `Enter the <strong>registration</strong> to find a specific livery, or use <strong>keywords</strong>.<div style="padding-top:8px"><video autoplay loop muted playsinline><source src="/guides/filterSection.webm" type="video/webm"></video></div>`,
        placement: "bottom",
        route: "/search",
    },
    {
        element: "#filters",
        title: "Use filters to narrow down your search",
        text: `Select from <strong>developer</strong>, <strong>aircraft</strong>, <strong>category</strong> and <strong>engines</strong>.<div style="padding-top:8px"><video autoplay loop muted playsinline><source src="/guides/filtering.webm" type="video/webm"></video></div>`,
        placement: "bottom",
        route: "/search",
    },
    {
        element: "#simulatorResolutionSelect",
        title: "Select simulator & resolution",
        text: "Don't forget to switch simulator and resolution to see desired liveries only.",
        placement: "auto",
        route: "/search",
    },
    {
        element: "#updatePage",
        title: "Updating liveries",
        text: `When updates are available, the <strong>livery cards</strong> will show in this page. <strong>Check for updates</strong> by clicking the button in the top right corner.<div style="padding-top:8px"><video autoplay loop muted playsinline><source src="/guides/updatePage.webm" type="video/webm"></video></div>`,
        placement: "auto",
        route: "/downloads",
    },
    {
        element: "#random",
        title: "Have a great flight!",
        text: `<img
               style="display:block;border-radius:8px;margin-bottom:12px" 
               src="/guides/endTour.webp" alt="End of the tour">
               We hope you enjoy the <strong>BAVirtual Livery Manager</strong>.<br/><br/>
               If you have any feedback or feature requests for the installer, please raise an issue via <a href="https://github.com/p-sergienko/bav-livery-manager/issues/">GitHub.</a><br/><br/>
               If you have any support needs regarding liveries, please raise a support ticket via <a href="https://support.bavirtual.co.uk/">the support portal.</a>`,
        placement: "auto",
        route: "/search",
    },
];
