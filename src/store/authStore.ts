import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthRole } from '@/types/auth';

export interface BrowserTokenPayload {
    token: string;
    role?: string | null;
    bawId?: string | null;
}

interface AuthState {
    userId: string | null;
    role: AuthRole | null;
    token: string | null;
    status: 'idle' | 'awaiting-browser' | 'error';
    error: string | null;
    isAuthenticated: boolean;
    markAwaitingAuth: () => void;
    applyBrowserToken: (payload: BrowserTokenPayload) => void;
    setError: (message: string | null) => void;
    logout: () => void;
}

const mapRole = (role?: string | null): AuthRole | null => {
    if (role === 'pilot' || role === 'admin') {
        return role;
    }
    return null;
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            userId: null,
            role: null,
            token: null,
            status: 'idle',
            error: null,
            isAuthenticated: false,
            markAwaitingAuth: () =>
                set({
                    status: 'awaiting-browser',
                    error: null,
                    isAuthenticated: false,
                    token: null,
                    role: null,
                    userId: null
                }),
            applyBrowserToken: (payload) => {
                if (!payload?.token) {
                    set({ status: 'error', error: 'Missing authentication token.' });
                    return;
                }

                set({
                    token: payload.token,
                    role: mapRole(payload.role),
                    userId: payload.bawId ?? null,
                    status: 'idle',
                    error: null,
                    isAuthenticated: true
                });
            },
            setError: (message) => set({ error: message, status: message ? 'error' : 'idle' }),
            logout: () =>
                set({ userId: null, role: null, token: null, status: 'idle', error: null, isAuthenticated: false })
        }),
        {
            name: 'bav-auth-store',
            storage: createJSONStorage(() => localStorage)
        }
    )
);
