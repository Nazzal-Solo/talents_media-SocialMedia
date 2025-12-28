import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../models/db';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  JWTPayload,
  RefreshTokenPayload,
} from '../utils/jwt';
import { logger } from '../middlewares';

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  displayName: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  password_hash?: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  website?: string;
  location?: string;
  theme_pref: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async register(data: RegisterData): Promise<AuthResult> {
    const { email, username, password, displayName } = data;

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('User with this email or username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    // Create user
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
      result = await query(
        `INSERT INTO users (id, email, username, password_hash, display_name, theme_pref)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, username, display_name, avatar_url, bio, website, location, theme_pref, role, created_at, updated_at`,
        [userId, email, username, passwordHash, displayName, 'dark-neon']
      );
      console.log('✅ [AuthService] User created successfully');
    } catch (dbError) {
      console.log('❌ [AuthService] Database error:', dbError);
      console.log('❌ [AuthService] Error message:', dbError.message);
      console.log('❌ [AuthService] Error code:', dbError.code);
      throw dbError;
    }

    const user = result.rows[0] as User;

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    const sessionId = uuidv4();
    const refreshToken = generateRefreshToken({
      userId: user.id,
      sessionId,
    });

    // Store refresh token
    await this.storeRefreshToken(sessionId, user.id, refreshToken);

    logger.info(`New user registered: ${user.email}`);

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  async login(data: LoginData): Promise<AuthResult> {
    const { email, password } = data;

    // Find user
    const result = await query(
      'SELECT id, email, username, password_hash, display_name, avatar_url, bio, website, location, theme_pref, role, created_at, updated_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0] as User;

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash || '');
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    const sessionId = uuidv4();
    const refreshToken = generateRefreshToken({
      userId: user.id,
      sessionId,
    });

    // Store refresh token
    await this.storeRefreshToken(sessionId, user.id, refreshToken);

    logger.info(`User logged in: ${user.email}`);

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(
    refreshToken: string,
    userAgent?: string,
    ip?: string
  ): Promise<AuthResult> {
    try {
      const payload = verifyRefreshToken(refreshToken);

      // Verify session exists and is valid
      const sessionResult = await query(
        'SELECT user_id FROM sessions WHERE id = $1 AND expires_at > NOW()',
        [payload.sessionId]
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Invalid refresh token');
      }

      const userId = sessionResult.rows[0].user_id;

      // Get user
      const userResult = await query(
        'SELECT id, email, username, display_name, avatar_url, bio, website, location, theme_pref, role, created_at, updated_at FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0] as User;

      // Generate new tokens
      const newAccessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      });

      const newSessionId = uuidv4();
      const newRefreshToken = generateRefreshToken({
        userId: user.id,
        sessionId: newSessionId,
      });

      // Remove old session and create new one
      await query('DELETE FROM sessions WHERE id = $1', [payload.sessionId]);
      await this.storeRefreshToken(
        newSessionId,
        user.id,
        newRefreshToken,
        userAgent,
        ip
      );

      return {
        user,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await query('DELETE FROM sessions WHERE id = $1', [payload.sessionId]);
    } catch (error) {
      // Ignore errors for logout
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }

  async storeRefreshToken(
    sessionId: string,
    userId: string,
    refreshToken: string,
    userAgent?: string,
    ip?: string
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Hash the refresh token before storing
    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

    await query(
      `INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sessionId, userId, refreshTokenHash, userAgent, ip, expiresAt]
    );
  }

  async getUserById(userId: string): Promise<User | null> {
    const result = await query(
      'SELECT id, email, username, display_name, avatar_url, bio, website, location, theme_pref, role, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await query(
      'SELECT id, email, username, display_name, avatar_url, bio, website, location, theme_pref, role, created_at, updated_at FROM users WHERE email = $1',
      [email]
    );

    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const result = await query(
      'SELECT id, email, username, display_name, avatar_url, bio, website, location, theme_pref, role, created_at, updated_at FROM users WHERE username = $1',
      [username]
    );

    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }
}
