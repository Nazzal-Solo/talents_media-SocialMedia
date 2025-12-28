import { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { query } from '../models/db';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { logger } from '../middlewares';

// Create email transporter
const createEmailTransporter = () => {
  // Use Gmail SMTP (most common for development)
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback: Gmail with app password
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  return null;
};

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export class PasswordResetService {
  async sendResetEmail(email: string): Promise<void> {
    // Find user
    const userResult = await query(
      'SELECT id, email, display_name FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      // Don't reveal if user exists or not
      return;
    }

    const user = userResult.rows[0];

    // Generate reset token
    const token = uuidv4().replace(/-/g, '');
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token
    await query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    const resetLink = `${process.env.WEB_URL}/reset-password?token=${token}`;

    // Send email using nodemailer
    const transporter = createEmailTransporter();

    if (transporter) {
      try {
        await transporter.sendMail({
          from:
            process.env.SMTP_FROM ||
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

        logger.info(`✅ Password reset email sent successfully to: ${email}`);
      } catch (error: any) {
        logger.error('❌ Failed to send password reset email:', error.message);
        logger.info('');
        logger.info('═══════════════════════════════════════════');
        logger.info('🔗 PASSWORD RESET LINK (Email failed):');
        logger.info(`   ${resetLink}`);
        logger.info('═══════════════════════════════════════════');
        logger.info(`Token expires in 1 hour for: ${email}`);
      }
    } else {
      // No email configured - log to console
      logger.info('');
      logger.info('═══════════════════════════════════════════');
      logger.info('🔗 PASSWORD RESET LINK (Dev Mode - No email configured):');
      logger.info(`   ${resetLink}`);
      logger.info('═══════════════════════════════════════════');
      logger.info(`Token expires in 1 hour for: ${email}`);
      logger.info(
        'To enable email: Set GMAIL_USER and GMAIL_APP_PASSWORD in .env'
      );
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    logger.info(
      `[Password Reset] Starting reset process for token: ${token.substring(0, 10)}...`
    );

    // Find valid reset token
    const resetResult = await query(
      `SELECT pr.id, pr.user_id, pr.token_hash, pr.expires_at, pr.used, pr.created_at
       FROM password_resets pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.expires_at > NOW() AND pr.used = FALSE`,
      []
    );

    logger.info(
      `[Password Reset] Found ${resetResult.rows.length} unused reset tokens`
    );

    let validReset = null;
    for (const reset of resetResult.rows) {
      const isValid = await bcrypt.compare(token, reset.token_hash);
      if (isValid) {
        validReset = reset;
        logger.info(
          `[Password Reset] Found valid reset token for user: ${reset.user_id}`
        );
        logger.info(`[Password Reset] Reset record: ${JSON.stringify(reset)}`);
        break;
      }
    }

    if (!validReset) {
      logger.error('[Password Reset] No valid reset token found');
      throw new Error('Invalid or expired reset token');
    }

    if (!validReset.user_id) {
      logger.error('[Password Reset] Invalid user_id in reset record');
      throw new Error('Invalid reset token data');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    logger.info(
      `[Password Reset] Password hashed, updating user: ${validReset.user_id}`
    );

    // Update user password
    const updateResult = await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, validReset.user_id]
    );

    logger.info(
      `[Password Reset] Password updated. Rows affected: ${updateResult.rowCount}`
    );

    if (updateResult.rowCount === 0) {
      logger.error(
        `[Password Reset] No rows updated for user_id: ${validReset.user_id}`
      );
      throw new Error('Failed to update password - user not found');
    }

    // Verify the password was saved
    const verifyResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [validReset.user_id]
    );

    if (verifyResult.rows.length === 0) {
      logger.error(
        `[Password Reset] User not found after update: ${validReset.user_id}`
      );
      throw new Error('Failed to verify password update');
    }

    const savedHash = verifyResult.rows[0].password_hash;
    const isMatch = await bcrypt.compare(newPassword, savedHash);

    if (!isMatch) {
      logger.error(
        `[Password Reset] Password verification failed for user: ${validReset.user_id}`
      );
      throw new Error('Password was not saved correctly');
    }

    logger.info(`[Password Reset] Password verified successfully`);

    // Mark reset token as used
    await query('UPDATE password_resets SET used = TRUE WHERE id = $1', [
      validReset.id,
    ]);

    logger.info(`[Password Reset] Reset token marked as used`);

    // Invalidate all user sessions
    await query('DELETE FROM sessions WHERE user_id = $1', [
      validReset.user_id,
    ]);

    logger.info(
      `[Password Reset] All sessions invalidated for user: ${validReset.user_id}`
    );
    logger.info(
      `[Password Reset] Password reset completed successfully for user: ${validReset.user_id}`
    );
  }
}

export class PasswordResetController {
  private passwordResetService = new PasswordResetService();

  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = forgotPasswordSchema.parse(req.body);

      await this.passwordResetService.sendResetEmail(validatedData.email);

      // Always return success to prevent email enumeration
      res.json({
        message:
          'If an account with that email exists, a password reset link has been sent.',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      logger.error('Forgot password error:', error);
      res
        .status(500)
        .json({ error: 'Failed to process password reset request' });
    }
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      logger.info(
        '[Password Reset Controller] Received reset password request'
      );
      const validatedData = resetPasswordSchema.parse(req.body);

      logger.info(
        '[Password Reset Controller] Data validated, calling service'
      );
      await this.passwordResetService.resetPassword(
        validatedData.token,
        validatedData.password
      );

      logger.info('[Password Reset Controller] Password reset successful');
      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      logger.error('[Password Reset Controller] Reset password error:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      logger.error('[Password Reset Controller] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(400).json({
        error: error instanceof Error ? error.message : 'Password reset failed',
      });
    }
  }
}
