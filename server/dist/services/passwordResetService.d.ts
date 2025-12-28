import { Request, Response } from 'express';
export declare class PasswordResetService {
    sendResetEmail(email: string): Promise<void>;
    resetPassword(token: string, newPassword: string): Promise<void>;
}
export declare class PasswordResetController {
    private passwordResetService;
    forgotPassword(req: Request, res: Response): Promise<void>;
    resetPassword(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=passwordResetService.d.ts.map