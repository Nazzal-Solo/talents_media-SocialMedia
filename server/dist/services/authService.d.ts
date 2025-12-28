export interface RegisterData {
    email: string;
    username: string;
    password: string;
    displayName: string;
}
export interface LoginData {
    email: string;
    password: string;
}
export interface User {
    id: string;
    email: string;
    username: string;
    password_hash?: string;
    display_name: string;
    avatar_url?: string;
    bio?: string;
    website?: string;
    location?: string;
    theme_pref: string;
    role: string;
    created_at: Date;
    updated_at: Date;
}
export interface AuthResult {
    user: User;
    accessToken: string;
    refreshToken: string;
}
export declare class AuthService {
    register(data: RegisterData): Promise<AuthResult>;
    login(data: LoginData): Promise<AuthResult>;
    refreshTokens(refreshToken: string, userAgent?: string, ip?: string): Promise<AuthResult>;
    logout(refreshToken: string): Promise<void>;
    logoutAll(userId: string): Promise<void>;
    storeRefreshToken(sessionId: string, userId: string, refreshToken: string, userAgent?: string, ip?: string): Promise<void>;
    getUserById(userId: string): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    getUserByUsername(username: string): Promise<User | null>;
}
//# sourceMappingURL=authService.d.ts.map