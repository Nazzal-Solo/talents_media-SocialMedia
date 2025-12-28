import { Request } from 'express';
export interface JWTPayload {
    userId: string;
    email: string;
    username: string;
    role: string;
}
export interface RefreshTokenPayload {
    userId: string;
    sessionId: string;
}
export declare const generateAccessToken: (payload: JWTPayload) => string;
export declare const generateRefreshToken: (payload: RefreshTokenPayload) => string;
export declare const verifyAccessToken: (token: string) => JWTPayload;
export declare const verifyRefreshToken: (token: string) => RefreshTokenPayload;
export declare const extractTokenFromRequest: (req: Request) => string | null;
//# sourceMappingURL=jwt.d.ts.map