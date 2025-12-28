import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService, RegisterData, LoginData } from '../services/authService';
import { AuthenticatedRequest } from '../middlewares/auth';
import { logger } from '../middlewares';

const authService = new AuthService();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(100, 'Display name must be less than 100 characters')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = registerSchema.parse(req.body);
      
      const result = await authService.register(validatedData as RegisterData);
      
      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        domain: process.env.COOKIE_DOMAIN
      });

      res.status(201).json({
        user: result.user,
        accessToken: result.accessToken
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: 'Validation failed', 
          details: error.errors 
        });
        return;
      }
      
      logger.error('Registration error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Registration failed' });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = loginSchema.parse(req.body);
      
      const result = await authService.login(validatedData as LoginData);
      
      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        domain: process.env.COOKIE_DOMAIN
      });

      res.json({
        user: result.user,
        accessToken: result.accessToken
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: 'Validation failed', 
          details: error.errors 
        });
        return;
      }
      
      logger.error('Login error:', error);
      res.status(401).json({ error: error instanceof Error ? error.message : 'Login failed' });
    }
  }

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken;
      
      if (!refreshToken) {
        res.status(401).json({ error: 'Refresh token not provided' });
        return;
      }

      const result = await authService.refreshTokens(
        refreshToken,
        req.get('User-Agent'),
        req.ip
      );
      
      // Set new refresh token as httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        domain: process.env.COOKIE_DOMAIN
      });

      res.json({
        user: result.user,
        accessToken: result.accessToken
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken;
      
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      
      // Clear refresh token cookie
      res.clearCookie('refreshToken', {
        domain: process.env.COOKIE_DOMAIN
      });

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      await authService.logoutAll(user.userId);
      
      // Clear refresh token cookie
      res.clearCookie('refreshToken', {
        domain: process.env.COOKIE_DOMAIN
      });

      res.json({ message: 'Logged out from all devices' });
    } catch (error) {
      logger.error('Logout all error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  async getMe(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const userData = await authService.getUserById(user.userId);
      
      if (!userData) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Log avatar_url for debugging
      logger.info(`[GetMe] User ${user.userId} avatar_url: ${userData.avatar_url || 'NULL'}`);
      console.log('🔍 [GetMe] Returning user data:', {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        avatar_url: userData.avatar_url,
      });

      res.json({ user: userData });
    } catch (error) {
      logger.error('Get me error:', error);
      res.status(500).json({ error: 'Failed to get user data' });
    }
  }
}
