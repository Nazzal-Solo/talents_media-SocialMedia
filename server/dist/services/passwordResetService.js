"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetController = exports.PasswordResetService = void 0;
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const db_1 = require("../models/db");
const middlewares_1 = require("../middlewares");
const createEmailTransporter = () => {
    if (process.env.SMTP_HOST) {
        return nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        return nodemailer_1.default.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });
    }
    return null;
};
const forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
});
const resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Reset token is required'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
class PasswordResetService {
    async sendResetEmail(email) {
        const userResult = await (0, db_1.query)('SELECT id, email, display_name FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return;
        }
        const user = userResult.rows[0];
        const token = (0, uuid_1.v4)().replace(/-/g, '');
        const tokenHash = await bcryptjs_1.default.hash(token, 10);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await (0, db_1.query)(`INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`, [user.id, tokenHash, expiresAt]);
        const resetLink = `${process.env.WEB_URL}/reset-password?token=${token}`;
        const transporter = createEmailTransporter();
        if (transporter) {
            try {
                await transporter.sendMail({
                    from: process.env.SMTP_FROM ||
                        process.env.GMAIL_USER ||
                        'noreply@social.com',
                    to: email,
                    subject: 'Password Reset Request',
                    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #7c3aed;">Reset Your Password</h2>
              <p>Hello ${user.display_name},</p>
              <p>You requested a password reset for your account. Click the button below to reset your password:</p>
              <a href="${resetLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                 Reset Password
              </a>
             
              <p style="color: #6b7280; font-size: 14px;">This link will expire in 1 hour.</p>
              <p>If you didn't request this, you can safely ignore this email.</p>
            </div>
          `,
                    text: `
            Password Reset Request
            
            Hello ${user.display_name},
            
            You requested a password reset. Use this link to reset your password:
            ${resetLink}
            
            This link expires in 1 hour.
            
            If you didn't request this, you can safely ignore this email.
          `,
                });
                middlewares_1.logger.info(`✅ Password reset email sent successfully to: ${email}`);
            }
            catch (error) {
                middlewares_1.logger.error('❌ Failed to send password reset email:', error.message);
                middlewares_1.logger.info('');
                middlewares_1.logger.info('═══════════════════════════════════════════');
                middlewares_1.logger.info('🔗 PASSWORD RESET LINK (Email failed):');
                middlewares_1.logger.info(`   ${resetLink}`);
                middlewares_1.logger.info('═══════════════════════════════════════════');
                middlewares_1.logger.info(`Token expires in 1 hour for: ${email}`);
            }
        }
        else {
            middlewares_1.logger.info('');
            middlewares_1.logger.info('═══════════════════════════════════════════');
            middlewares_1.logger.info('🔗 PASSWORD RESET LINK (Dev Mode - No email configured):');
            middlewares_1.logger.info(`   ${resetLink}`);
            middlewares_1.logger.info('═══════════════════════════════════════════');
            middlewares_1.logger.info(`Token expires in 1 hour for: ${email}`);
            middlewares_1.logger.info('To enable email: Set GMAIL_USER and GMAIL_APP_PASSWORD in .env');
        }
    }
    async resetPassword(token, newPassword) {
        middlewares_1.logger.info(`[Password Reset] Starting reset process for token: ${token.substring(0, 10)}...`);
        const resetResult = await (0, db_1.query)(`SELECT pr.id, pr.user_id, pr.token_hash, pr.expires_at, pr.used, pr.created_at
       FROM password_resets pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.expires_at > NOW() AND pr.used = FALSE`, []);
        middlewares_1.logger.info(`[Password Reset] Found ${resetResult.rows.length} unused reset tokens`);
        let validReset = null;
        for (const reset of resetResult.rows) {
            const isValid = await bcryptjs_1.default.compare(token, reset.token_hash);
            if (isValid) {
                validReset = reset;
                middlewares_1.logger.info(`[Password Reset] Found valid reset token for user: ${reset.user_id}`);
                middlewares_1.logger.info(`[Password Reset] Reset record: ${JSON.stringify(reset)}`);
                break;
            }
        }
        if (!validReset) {
            middlewares_1.logger.error('[Password Reset] No valid reset token found');
            throw new Error('Invalid or expired reset token');
        }
        if (!validReset.user_id) {
            middlewares_1.logger.error('[Password Reset] Invalid user_id in reset record');
            throw new Error('Invalid reset token data');
        }
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
        middlewares_1.logger.info(`[Password Reset] Password hashed, updating user: ${validReset.user_id}`);
        const updateResult = await (0, db_1.query)('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, validReset.user_id]);
        middlewares_1.logger.info(`[Password Reset] Password updated. Rows affected: ${updateResult.rowCount}`);
        if (updateResult.rowCount === 0) {
            middlewares_1.logger.error(`[Password Reset] No rows updated for user_id: ${validReset.user_id}`);
            throw new Error('Failed to update password - user not found');
        }
        const verifyResult = await (0, db_1.query)('SELECT password_hash FROM users WHERE id = $1', [validReset.user_id]);
        if (verifyResult.rows.length === 0) {
            middlewares_1.logger.error(`[Password Reset] User not found after update: ${validReset.user_id}`);
            throw new Error('Failed to verify password update');
        }
        const savedHash = verifyResult.rows[0].password_hash;
        const isMatch = await bcryptjs_1.default.compare(newPassword, savedHash);
        if (!isMatch) {
            middlewares_1.logger.error(`[Password Reset] Password verification failed for user: ${validReset.user_id}`);
            throw new Error('Password was not saved correctly');
        }
        middlewares_1.logger.info(`[Password Reset] Password verified successfully`);
        await (0, db_1.query)('UPDATE password_resets SET used = TRUE WHERE id = $1', [
            validReset.id,
        ]);
        middlewares_1.logger.info(`[Password Reset] Reset token marked as used`);
        await (0, db_1.query)('DELETE FROM sessions WHERE user_id = $1', [
            validReset.user_id,
        ]);
        middlewares_1.logger.info(`[Password Reset] All sessions invalidated for user: ${validReset.user_id}`);
        middlewares_1.logger.info(`[Password Reset] Password reset completed successfully for user: ${validReset.user_id}`);
    }
}
exports.PasswordResetService = PasswordResetService;
class PasswordResetController {
    constructor() {
        this.passwordResetService = new PasswordResetService();
    }
    async forgotPassword(req, res) {
        try {
            const validatedData = forgotPasswordSchema.parse(req.body);
            await this.passwordResetService.sendResetEmail(validatedData.email);
            res.json({
                message: 'If an account with that email exists, a password reset link has been sent.',
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors,
                });
                return;
            }
            middlewares_1.logger.error('Forgot password error:', error);
            res
                .status(500)
                .json({ error: 'Failed to process password reset request' });
        }
    }
    async resetPassword(req, res) {
        try {
            middlewares_1.logger.info('[Password Reset Controller] Received reset password request');
            const validatedData = resetPasswordSchema.parse(req.body);
            middlewares_1.logger.info('[Password Reset Controller] Data validated, calling service');
            await this.passwordResetService.resetPassword(validatedData.token, validatedData.password);
            middlewares_1.logger.info('[Password Reset Controller] Password reset successful');
            res.json({ message: 'Password reset successfully' });
        }
        catch (error) {
            middlewares_1.logger.error('[Password Reset Controller] Reset password error:', error);
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors,
                });
                return;
            }
            middlewares_1.logger.error('[Password Reset Controller] Error details:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
            res.status(400).json({
                error: error instanceof Error ? error.message : 'Password reset failed',
            });
        }
    }
}
exports.PasswordResetController = PasswordResetController;
//# sourceMappingURL=passwordResetService.js.map