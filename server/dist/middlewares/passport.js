"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const authService_1 = require("../services/authService");
const db_1 = require("../models/db");
const middlewares_1 = require("../middlewares");
const oauth_1 = require("../config/oauth");
const authService = new authService_1.AuthService();
const CALLBACK_URL = (0, oauth_1.resolveGoogleCallbackUrl)();
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('[OAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}
console.log('[OAuth] Google callback URL:', CALLBACK_URL);
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
    console.log('🔍 [Passport] Google OAuth callback received');
    console.log('🔍 [Passport] Full profile object:', JSON.stringify(profile, null, 2));
    console.log('🔍 [Passport] Profile photos:', profile.photos);
    console.log('🔍 [Passport] Profile photos type:', typeof profile.photos);
    console.log('🔍 [Passport] Profile photos length:', profile.photos?.length);
    try {
        const { id, emails, displayName, photos } = profile;
        if (!emails || emails.length === 0) {
            console.log('❌ [Passport] No email found in Google profile');
            return done(new Error('No email found in Google profile'), undefined);
        }
        const email = emails[0].value;
        let avatarUrl = undefined;
        if (photos && Array.isArray(photos) && photos.length > 0) {
            if (photos[0].value) {
                avatarUrl = photos[0].value;
            }
            else if (typeof photos[0] === 'string') {
                avatarUrl = photos[0];
            }
        }
        if (!avatarUrl && profile.picture) {
            avatarUrl = profile.picture;
        }
        console.log('🔍 [Passport] Extracted avatarUrl:', avatarUrl);
        console.log('🔍 [Passport] Processing user with email:', email);
        console.log('🔍 [Passport] Checking for existing user with Google ID:', id);
        let user = await (0, db_1.query)('SELECT * FROM users WHERE google_id = $1', [
            id,
        ]);
        if (user.rows.length > 0) {
            const existingUser = user.rows[0];
            console.log('✅ [Passport] Found existing user with Google ID:', existingUser.id, 'Current avatar_url:', existingUser.avatar_url);
            if (avatarUrl && (!existingUser.avatar_url || avatarUrl !== existingUser.avatar_url)) {
                console.log('🔄 [Passport] Updating avatar_url from Google profile');
                console.log('🔄 [Passport] Old avatar_url:', existingUser.avatar_url);
                console.log('🔄 [Passport] New avatar_url:', avatarUrl);
                const updateResult = await (0, db_1.query)('UPDATE users SET avatar_url = $1 WHERE google_id = $2 RETURNING *', [avatarUrl, id]);
                const updatedUser = updateResult.rows[0];
                console.log('✅ [Passport] Updated user avatar_url:', updatedUser.avatar_url);
                return done(null, updatedUser);
            }
            else if (!avatarUrl) {
                console.log('⚠️ [Passport] No avatar URL provided by Google');
            }
            else {
                console.log('ℹ️ [Passport] Avatar URL unchanged, keeping existing');
            }
            return done(null, existingUser);
        }
        console.log('🔍 [Passport] Checking for existing user with email:', email);
        user = await (0, db_1.query)('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length > 0) {
            console.log('✅ [Passport] Found existing user with email, linking Google account');
            await (0, db_1.query)('UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2) WHERE email = $3', [id, avatarUrl, email]);
            const updatedUser = await (0, db_1.query)('SELECT * FROM users WHERE email = $1', [email]);
            console.log('✅ [Passport] Google account linked to existing user:', updatedUser.rows[0]);
            return done(null, updatedUser.rows[0]);
        }
        console.log('🔍 [Passport] Creating new user');
        const username = email.split('@')[0] + '_' + Math.random().toString(36).substr(2, 4);
        console.log('🔍 [Passport] Generated username:', username);
        console.log('🔍 [Passport] Creating new user with avatar_url:', avatarUrl);
        const newUser = await (0, db_1.query)(`INSERT INTO users (email, username, google_id, display_name, avatar_url, theme_pref)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`, [email, username, id, displayName, avatarUrl || null, 'dark-neon']);
        const createdUser = newUser.rows[0];
        console.log('✅ [Passport] New Google user created:', {
            id: createdUser.id,
            email: createdUser.email,
            username: createdUser.username,
            avatar_url: createdUser.avatar_url,
        });
        middlewares_1.logger.info(`New Google user created: ${email} with avatar_url: ${createdUser.avatar_url || 'none'}`);
        return done(null, createdUser);
    }
    catch (error) {
        console.log('❌ [Passport] Error in Google OAuth strategy:', error);
        console.log('❌ [Passport] Error stack:', error.stack);
        middlewares_1.logger.error('Google OAuth error:', error);
        return done(error, undefined);
    }
}));
passport_1.default.serializeUser((user, done) => {
    done(null, user.id);
});
passport_1.default.deserializeUser(async (id, done) => {
    try {
        const user = await authService.getUserById(id);
        done(null, user);
    }
    catch (error) {
        done(error, null);
    }
});
exports.default = passport_1.default;
//# sourceMappingURL=passport.js.map