import { Request, Response } from 'express';
export declare class AuthController {
    register(req: Request, res: Response): Promise<void>;
    login(req: Request, res: Response): Promise<void>;
    refresh(req: Request, res: Response): Promise<void>;
    logout(req: Request, res: Response): Promise<void>;
    logoutAll(req: Request, res: Response): Promise<void>;
    getMe(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=authController.d.ts.map