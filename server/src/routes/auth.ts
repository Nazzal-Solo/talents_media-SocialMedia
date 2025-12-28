import { Router } from 'express';
import passport from 'passport';
import { AuthController } from '../controllers/authController';
import { PasswordResetController } from '../services/passwordResetService';
import { authGuard } from '../middlewares/auth';
import { authRateLimit } from '../middlewares';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import { query } from '../models/db';
import { logger } from '../middlewares';
import { resolveGoogleCallbackUrl } from '../config/oauth';

const router = Router();
const authController = new AuthController();
const passwordResetController = new PasswordResetController();

// Public routes
router.post(
  '/register',
  authRateLimit,
  authController.register.bind(authController)
);
router.post('/login', authRateLimit, authController.login.bind(authController));
router.post('/refresh', authRateLimit, authController.refresh.bind(authController));
router.post(
  '/forgot-password',
  authRateLimit,
  passwordResetController.forgotPassword.bind(passwordResetController)
);
router.post(
  '/reset-password',
  authRateLimit,
  passwordResetController.resetPassword.bind(passwordResetController)
);

// Google OAuth routes
router.get(
  '/google',
  (req, res, next) => {
    console.log('🔍 [OAuth Init] Google OAuth initiation route hit');
    console.log('🔍 [OAuth Init] Request URL:', req.url);
    console.log('🔍 [OAuth Init] About to call passport.authenticate...');
    next();
  },
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Dynamic callback path based on env (relative to /api/auth mount)
const callbackPath =
  process.env.GOOGLE_CALLBACK_PATH?.replace('/api/auth', '') ||
  '/google/callback';

console.log('🔍 [OAuth Config] Callback path resolved to:', callbackPath);
console.log('🔍 [OAuth Config] Full callback URL:', resolveGoogleCallbackUrl());
router.get(
  callbackPath,
  (req, res, next) => {
    console.log('🔍 [OAuth Route] Google callback route hit');
    console.log('🔍 [OAuth Route] Request URL:', req.url);
    console.log('🔍 [OAuth Route] Request query:', req.query);
    console.log('🔍 [OAuth Route] About to call passport.authenticate...');
    next();
  },
  passport.authenticate('google', { session: false }),
  async (req, res) => {
    console.log('🔍 [OAuth Callback] Starting callback processing...');
    console.log('🔍 [OAuth Callback] Request URL:', req.url);
    console.log('🔍 [OAuth Callback] Request query:', req.query);
    console.log('🔍 [OAuth Callback] Request user:', req.user);

    try {
      const user = req.user as any;
      console.log('🔍 [OAuth Callback] User from passport:', user);

      if (!user) {
        console.log('❌ [OAuth Callback] No user found in request');
        return res.redirect(`${process.env.WEB_URL}/login?error=oauth_failed`);
      }

      console.log('✅ [OAuth Callback] User found:', {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        password_hash: user.password_hash,
        google_id: user.google_id,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      });

      // Generate tokens
      console.log('🔍 [OAuth Callback] Generating access token...');
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      });
      console.log('✅ [OAuth Callback] Access token generated');

      console.log('🔍 [OAuth Callback] Generating refresh token...');
      const sessionId = require('uuid').v4();
      const refreshToken = generateRefreshToken({
        userId: user.id,
        sessionId,
      });
      console.log(
        '✅ [OAuth Callback] Refresh token generated, sessionId:',
        sessionId
      );

      // Store refresh token using AuthService
      console.log('🔍 [OAuth Callback] Storing refresh token in database...');
      const { AuthService } = await import('../services/authService');
      const authService = new AuthService();
      await authService.storeRefreshToken(
        sessionId,
        user.id,
        refreshToken,
        req.get('User-Agent'),
        req.ip
      );
      console.log('✅ [OAuth Callback] Refresh token stored in database');

      // Set refresh token as httpOnly cookie
      console.log('🔍 [OAuth Callback] Setting refresh token cookie...');
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        domain: process.env.COOKIE_DOMAIN,
      });
      console.log('✅ [OAuth Callback] Refresh token cookie set');

      // Redirect to frontend with tokens
      const webUrl = process.env.WEB_URL || 'http://localhost:3000';
      const redirectUrl = `${webUrl}/auth/callback?accessToken=${accessToken}`;
      console.log('🔍 [OAuth Callback] WEB_URL from env:', process.env.WEB_URL);
      console.log('🔍 [OAuth Callback] Redirecting to:', redirectUrl);
      res.redirect(redirectUrl);
      console.log('✅ [OAuth Callback] Redirect completed successfully');
    } catch (error) {
      console.log('❌ [OAuth Callback] Error occurred:', error);
      console.log('❌ [OAuth Callback] Error message:', error.message);
      console.log('❌ [OAuth Callback] Error stack:', error.stack);
      console.log('❌ [OAuth Callback] Error name:', error.name);
      logger.error('Google OAuth callback error:', error);
      res.redirect(`${process.env.WEB_URL}/login?error=oauth_failed`);
    }
  }
);

// Debug: see what URL you must paste into Google Console
router.get('/google/callback/debug', (_req, res) => {
  res.json({ googleCallbackUrl: resolveGoogleCallbackUrl() });
});

// Protected routes
router.post('/logout', authController.logout.bind(authController));
router.post(
  '/logout-all',
  authGuard,
  authController.logoutAll.bind(authController)
);
router.get('/me', authGuard, authController.getMe.bind(authController));

export default router;
