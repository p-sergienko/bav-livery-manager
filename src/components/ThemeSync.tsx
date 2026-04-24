import {useThemeStore} from "@/store/themeStore";
import {useEffect} from "react";

export const ThemeSync = () => {
    const theme = useThemeStore((state) => state.theme);

    useEffect(() => {
        console.log("ThemeSync", theme);
        const root = document.documentElement;
        Object.entries(theme).forEach(([key, value]) => {
            const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
            root.style.setProperty(cssVar, value);
        });
    }, [theme]);

    return null;
}