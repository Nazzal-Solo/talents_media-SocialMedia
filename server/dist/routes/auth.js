"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const authController_1 = require("../controllers/authController");
const passwordResetService_1 = require("../services/passwordResetService");
const auth_1 = require("../middlewares/auth");
const middlewares_1 = require("../middlewares");
const jwt_1 = require("../utils/jwt");
const middlewares_2 = require("../middlewares");
const oauth_1 = require("../config/oauth");
const router = (0, express_1.Router)();
const authController = new authController_1.AuthController();
const passwordResetController = new passwordResetService_1.PasswordResetController();
router.post('/register', middlewares_1.authRateLimit, authController.register.bind(authController));
router.post('/login', middlewares_1.authRateLimit, authController.login.bind(authController));
router.post('/refresh', authController.refresh.bind(authController));
router.post('/forgot-password', middlewares_1.authRateLimit, passwordResetController.forgotPassword.bind(passwordResetController));
router.post('/reset-password', middlewares_1.authRateLimit, passwordResetController.resetPassword.bind(passwordResetController));
router.get('/google', (req, res, next) => {
    console.log('🔍 [OAuth Init] Google OAuth initiation route hit');
    console.log('🔍 [OAuth Init] Request URL:', req.url);
    console.log('🔍 [OAuth Init] About to call passport.authenticate...');
    next();
}, passport_1.default.authenticate('google', { scope: ['profile', 'email'] }));
const callbackPath = process.env.GOOGLE_CALLBACK_PATH?.replace('/api/auth', '') ||
    '/google/callback';
console.log('🔍 [OAuth Config] Callback path resolved to:', callbackPath);
console.log('🔍 [OAuth Config] Full callback URL:', (0, oauth_1.resolveGoogleCallbackUrl)());
router.get(callbackPath, (req, res, next) => {
    console.log('🔍 [OAuth Route] Google callback route hit');
    console.log('🔍 [OAuth Route] Request URL:', req.url);
    console.log('🔍 [OAuth Route] Request query:', req.query);
    console.log('🔍 [OAuth Route] About to call passport.authenticate...');
    next();
}, passport_1.default.authenticate('google', { session: false }), async (req, res) => {
    console.log('🔍 [OAuth Callback] Starting callback processing...');
    console.log('🔍 [OAuth Callback] Request URL:', req.url);
    console.log('🔍 [OAuth Callback] Request query:', req.query);
    console.log('🔍 [OAuth Callback] Request user:', req.user);
    try {
        const user = req.user;
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
        console.log('🔍 [OAuth Callback] Generating access token...');
        const accessToken = (0, jwt_1.generateAccessToken)({
            userId: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
        });
        console.log('✅ [OAuth Callback] Access token generated');
        console.log('🔍 [OAuth Callback] Generating refresh token...');
        const sessionId = require('uuid').v4();
        const refreshToken = (0, jwt_1.generateRefreshToken)({
            userId: user.id,
            sessionId,
        });
        console.log('✅ [OAuth Callback] Refresh token generated, sessionId:', sessionId);
        console.log('🔍 [OAuth Callback] Storing refresh token in database...');
        const { AuthService } = await Promise.resolve().then(() => __importStar(require('../services/authService')));
        const authService = new AuthService();
        await authService.storeRefreshToken(sessionId, user.id, refreshToken, req.get('User-Agent'), req.ip);
        console.log('✅ [OAuth Callback] Refresh token stored in database');
        console.log('🔍 [OAuth Callback] Setting refresh token cookie...');
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000,
            domain: process.env.COOKIE_DOMAIN,
        });
        console.log('✅ [OAuth Callback] Refresh token cookie set');
        const webUrl = process.env.WEB_URL || 'http://localhost:3000';
        const redirectUrl = `${webUrl}/auth/callback?accessToken=${accessToken}`;
        console.log('🔍 [OAuth Callback] WEB_URL from env:', process.env.WEB_URL);
        console.log('🔍 [OAuth Callback] Redirecting to:', redirectUrl);
        res.redirect(redirectUrl);
        console.log('✅ [OAuth Callback] Redirect completed successfully');
    }
    catch (error) {
        console.log('❌ [OAuth Callback] Error occurred:', error);
        console.log('❌ [OAuth Callback] Error message:', error.message);
        console.log('❌ [OAuth Callback] Error stack:', error.stack);
        console.log('❌ [OAuth Callback] Error name:', error.name);
        middlewares_2.logger.error('Google OAuth callback error:', error);
        res.redirect(`${process.env.WEB_URL}/login?error=oauth_failed`);
    }
});
router.get('/google/callback/debug', (_req, res) => {
    res.json({ googleCallbackUrl: (0, oauth_1.resolveGoogleCallbackUrl)() });
});
router.post('/logout', authController.logout.bind(authController));
router.post('/logout-all', auth_1.authGuard, authController.logoutAll.bind(authController));
router.get('/me', auth_1.authGuard, authController.getMe.bind(authController));
exports.default = router;
//# sourceMappingURL=auth.js.map