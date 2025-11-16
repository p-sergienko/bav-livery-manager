export type AuthRole = 'pilot' | 'admin';

export interface AuthResponse {
    role: AuthRole;
    token: string;
    redirectUrl?: string;
    message: string;
}
