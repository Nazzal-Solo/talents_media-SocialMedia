"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const zod_1 = require("zod");
const authService_1 = require("../services/authService");
const middlewares_1 = require("../middlewares");
const authService = new authService_1.AuthService();
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    username: zod_1.z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    displayName: zod_1.z.string().min(1).max(100, 'Display name must be less than 100 characters')
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required')
});
const refreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required')
});
class AuthController {
    async register(req, res) {
        try {
            const validatedData = registerSchema.parse(req.body);
            const result = await authService.register(validatedData);
            res.cookie('refreshToken', result.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 30 * 24 * 60 * 60 * 1000,
                domain: process.env.COOKIE_DOMAIN
            });
            res.status(201).json({
                user: result.user,
                accessToken: result.accessToken
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors
                });
                return;
            }
            middlewares_1.logger.error('Registration error:', error);
            res.status(400).json({ error: error instanceof Error ? error.message : 'Registration failed' });
        }
    }
    async login(req, res) {
        try {
            const validatedData = loginSchema.parse(req.body);
            const result = await authService.login(validatedData);
            res.cookie('refreshToken', result.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 30 * 24 * 60 * 60 * 1000,
                domain: process.env.COOKIE_DOMAIN
            });
            res.json({
                user: result.user,
                accessToken: result.accessToken
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors
                });
                return;
            }
            middlewares_1.logger.error('Login error:', error);
            res.status(401).json({ error: error instanceof Error ? error.message : 'Login failed' });
        }
    }
    async refresh(req, res) {
        try {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) {
                res.status(401).json({ error: 'Refresh token not provided' });
                return;
            }
            const result = await authService.refreshTokens(refreshToken, req.get('User-Agent'), req.ip);
            res.cookie('refreshToken', result.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000,
                domain: process.env.COOKIE_DOMAIN
            });
            res.json({
                user: result.user,
                accessToken: result.accessToken
            });
        }
        catch (error) {
            middlewares_1.logger.error('Token refresh error:', error);
            res.status(401).json({ error: 'Invalid refresh token' });
        }
    }
    async logout(req, res) {
        try {
            const refreshToken = req.cookies.refreshToken;
            if (refreshToken) {
                await authService.logout(refreshToken);
            }
            res.clearCookie('refreshToken', {
                domain: process.env.COOKIE_DOMAIN
            });
            res.json({ message: 'Logged out successfully' });
        }
        catch (error) {
            middlewares_1.logger.error('Logout error:', error);
            res.status(500).json({ error: 'Logout failed' });
        }
    }
    async logoutAll(req, res) {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            await authService.logoutAll(user.userId);
            res.clearCookie('refreshToken', {
                domain: process.env.COOKIE_DOMAIN
            });
            res.json({ message: 'Logged out from all devices' });
        }
        catch (error) {
            middlewares_1.logger.error('Logout all error:', error);
            res.status(500).json({ error: 'Logout failed' });
        }
    }
    async getMe(req, res) {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const userData = await authService.getUserById(user.userId);
            if (!userData) {
                res.status(404).json({ error: 'User not found' });
                return;
            }
            middlewares_1.logger.info(`[GetMe] User ${user.userId} avatar_url: ${userData.avatar_url || 'NULL'}`);
            console.log('🔍 [GetMe] Returning user data:', {
                id: userData.id,
                email: userData.email,
                username: userData.username,
                avatar_url: userData.avatar_url,
            });
            res.json({ user: userData });
        }
        catch (error) {
            middlewares_1.logger.error('Get me error:', error);
            res.status(500).json({ error: 'Failed to get user data' });
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=authController.js.map