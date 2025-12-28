import { Request, Response, NextFunction } from 'express';
export declare const logger: import("pino").Logger<never>;
export declare const createRateLimit: (windowMs: number, max: number, message?: string) => import("express-rate-limit").RateLimitRequestHandler;
export declare const authRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const generalRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const strictRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const securityMiddleware: ((req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void)[];
export declare const requestLogger: (req: Request, res: Response, next: NextFunction) => void;
export declare const geoCapture: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const errorHandler: (error: Error, req: Request, res: Response, next: NextFunction) => void;
export declare const notFound: (req: Request, res: Response) => void;
declare global {
    namespace Express {
        interface Request {
            geo?: {
                country: string;
                city: string;
                ip: string;
            };
        }
    }
}
//# sourceMappingURL=index.d.ts.map