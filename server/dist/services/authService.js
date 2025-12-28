"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const db_1 = require("../models/db");
const jwt_1 = require("../utils/jwt");
const middlewares_1 = require("../middlewares");
class AuthService {
    async register(data) {
        const { email, username, password, displayName } = data;
        const existingUser = await (0, db_1.query)('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);
        if (existingUser.rows.length > 0) {
            throw new Error('User with this email or username already exists');
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const userId = (0, uuid_1.v4)();
        console.log('🔍 [AuthService] Creating user with data:', {
            userId,
            email,
            username,
            passwordHashLength: passwordHash.length,
            displayName,
            themePref: 'dark-neon',
        });
        let result;
        try {
            result = await (0, db_1.query)(`INSERT INTO users (id, email, username, password_hash, display_name, theme_pref)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, username, display_name, avatar_url, bio, website, location, theme_pref, role, created_at, updated_at`, [userId, email, username, passwordHash, displayName, 'dark-neon']);
            console.log('✅ [AuthService] User created successfully');
        }
        catch (dbError) {
            console.log('❌ [AuthService] Database error:', dbError);
            console.log('❌ [AuthService] Error message:', dbError.message);
            console.log('❌ [AuthService] Error code:', dbError.code);
            throw dbError;
        }
        const user = result.rows[0];
        const accessToken = (0, jwt_1.generateAccessToken)({
            userId: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
        });
        const sessionId = (0, uuid_1.v4)();
        const refreshToken = (0, jwt_1.generateRefreshToken)({
            userId: user.id,
            sessionId,
        });
        await this.storeRefreshToken(sessionId, user.id, refreshToken);
        middlewares_1.logger.info(`New user registered: ${user.email}`);
        return {
            user,
            accessToken,
            refreshToken,
        };
    }
    async login(data) {
        const { email, password } = data;
        const result = await (0, db_1.query)('SELECT id, email, username, password_hash, display_name, avatar_url, bio, website, location, theme_pref, role, created_at, updated_at FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            throw new Error('Invalid credentials');
        }
        const user = result.rows[0];
        const isValid = await bcryptjs_1.default.compare(password, user.password_hash || '');
        if (!isValid) {
            throw new Error('Invalid credentials');
        }
        const accessToken = (0, jwt_1.generateAccessToken)({
            userId: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
        });
        const sessionId = (0, uuid_1.v4)();
        const refreshToken = (0, jwt_1.generateRefreshToken)({
            userId: user.id,
            sessionId,
        });
        await this.storeRefreshToken(sessionId, user.id, refreshToken);
        middlewares_1.logger.info(`User logged in: ${user.email}`);
        return {
            user,
            accessToken,
            refreshToken,
        };
    }
    async refreshTokens(refreshToken, userAgent, ip) {
        try {
            const payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
            const sessionResult = await (0, db_1.query)('SELECT user_id FROM sessions WHERE id = $1 AND expires_at > NOW()', [payload.sessionId]);
            if (sessionResult.rows.length === 0) {
                throw new Error('Invalid refresh token');
            }
            const userId = sessionResult.rows[0].user_id;
            const userResult = await (0, db_1.query)('SELECT id, email, username, display_name, avatar_url, bio, website, location, theme_pref, role, created_at, updated_at FROM users WHERE id = $1', [userId]);
            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }
            const user = userResult.rows[0];
            const newAccessToken = (0, jwt_1.generateAccessToken)({
                userId: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
            });
            const newSessionId = (0, uuid_1.v4)();
            const newRefreshToken = (0, jwt_1.generateRefreshToken)({
                userId: user.id,
                sessionId: newSessionId,
            });
            await (0, db_1.query)('DELETE FROM sessions WHERE id = $1', [payload.sessionId]);
            await this.storeRefreshToken(newSessionId, user.id, newRefreshToken, userAgent, ip);
            return {
                user,
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
            };
        }
        catch (error) {
            throw new Error('Invalid refresh token');
        }
    }
    async logout(refreshToken) {
        try {
            const payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
            await (0, db_1.query)('DELETE FROM sessions WHERE id = $1', [payload.sessionId]);
        }
        catch (error) {
        }
    }
    async logoutAll(userId) {
        await (0, db_1.query)('DELETE FROM sessions WHERE user_id = $1', [userId]);
    }
    async storeRefreshToken(sessionId, userId, refreshToken, userAgent, ip) {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const refreshTokenHash = await bcryptjs_1.default.hash(refreshToken, 12);
        await (0, db_1.query)(`INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`, [sessionId, userId, refreshTokenHash, userAgent, ip, expiresAt]);
    }
    async getUserById(userId) {
        const result = await (0, db_1.query)('SELECT id, email, username, display_name, avatar_url, bio, website, location, theme_pref, role, created_at, updated_at FROM users WHERE id = $1', [userId]);
        return result.rows.length > 0 ? result.rows[0] : null;
    }
    async getUserByEmail(email) {
        const result = await (0, db_1.query)('SELECT id, email, username, display_name, avatar_url, bio, website, location, theme_pref, role, created_at, updated_at FROM users WHERE email = $1', [email]);
        return result.rows.length > 0 ? result.rows[0] : null;
    }
    async getUserByUsername(username) {
        const result = await (0, db_1.query)('SELECT id, email, username, display_name, avatar_url, bio, website, location, theme_pref, role, created_at, updated_at FROM users WHERE username = $1', [username]);
        return result.rows.length > 0 ? result.rows[0] : null;
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=authService.js.map