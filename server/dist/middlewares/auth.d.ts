import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from '../utils/jwt';
export interface AuthenticatedRequest extends Request {
    user?: JWTPayload;
}
export declare const authGuard: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const adminGuard: (req: Request, res: Response, next: NextFunction) => void;
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map