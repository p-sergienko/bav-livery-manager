import { create } from 'zustand';

export type UpdatePhase =
    | { phase: 'idle' }
    | { phase: 'checking' }
    | { phase: 'available'; version: string; releaseDate?: string }
    | { phase: 'up-to-date' }
    | { phase: 'downloading'; percent: number; bytesPerSecond: number; transferred: number; total: number }
    | { phase: 'downloaded'; version: string }
    | { phase: 'error'; message: string };

interface AppUpdateState {
    update: UpdatePhase;
    bannerDismissed: boolean;
    setUpdate: (update: UpdatePhase) => void;
    dismissBanner: () => void;
}

export const useAppUpdateStore = create<AppUpdateState>((set) => ({
    update: { phase: 'idle' },
    bannerDismissed: false,
    setUpdate: (update) =>
        set((prev) => ({
            update,
            // Re-show banner whenever a new actionable phase is reached
            bannerDismissed:
                update.phase === 'available' || update.phase === 'downloaded'
                    ? false
                    : prev.bannerDismissed,
        })),
    dismissBanner: () => set({ bannerDismissed: true }),
}));
