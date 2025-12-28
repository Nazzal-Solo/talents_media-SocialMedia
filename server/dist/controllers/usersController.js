"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
const zod_1 = require("zod");
const usersService_1 = require("../services/usersService");
const middlewares_1 = require("../middlewares");
const db_1 = require("../models/db");
const usersService = new usersService_1.UsersService();
const updateProfileSchema = zod_1.z.object({
    display_name: zod_1.z
        .string()
        .min(1)
        .max(100, 'Display name must be less than 100 characters')
        .optional(),
    bio: zod_1.z.string().max(500, 'Bio must be less than 500 characters').optional(),
    website: zod_1.z.string().url('Invalid website URL').optional().or(zod_1.z.literal('')),
    location: zod_1.z
        .string()
        .max(100, 'Location must be less than 100 characters')
        .optional(),
    theme_pref: zod_1.z
        .enum(['dark-neon', 'light', 'cyan', 'magenta', 'violet'], {
        errorMap: () => ({ message: 'Invalid theme preference' }),
    })
        .optional(),
});
class UsersController {
    async getMe(req, res) {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const userData = await usersService.getUserById(req.user.userId);
            if (!userData) {
                res.status(404).json({ error: 'User not found' });
                return;
            }
            res.json({ user: userData });
        }
        catch (error) {
            middlewares_1.logger.error('Get me error:', error);
            res.status(500).json({ error: 'Failed to get user data' });
        }
    }
    async updateProfile(req, res) {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const validatedData = updateProfileSchema.parse(req.body);
            const updatedUser = await usersService.updateProfile(req.user.userId, validatedData);
            if (!updatedUser) {
                res.status(404).json({ error: 'User not found' });
                return;
            }
            res.json({ user: updatedUser });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors,
                });
                return;
            }
            middlewares_1.logger.error('Update profile error:', error);
            res.status(500).json({ error: 'Failed to update profile' });
        }
    }
    async getUserProfile(req, res) {
        try {
            const { username } = req.params;
            const currentUserId = req.user?.userId;
            const profile = await usersService.getUserProfile(username, currentUserId);
            if (!profile) {
                res.status(404).json({ error: 'User not found' });
                return;
            }
            res.json({ profile });
        }
        catch (error) {
            middlewares_1.logger.error('Get user profile error:', error);
            res.status(500).json({ error: 'Failed to get user profile' });
        }
    }
    async followUser(req, res) {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { username } = req.params;
            if (username === req.user.username) {
                res.status(400).json({ error: 'Cannot follow yourself' });
                return;
            }
            const success = await usersService.followUser(req.user.userId, username);
            if (!success) {
                res.status(400).json({ error: 'User not found or already following' });
                return;
            }
            res.json({ message: 'User followed successfully' });
        }
        catch (error) {
            middlewares_1.logger.error('Follow user error:', error);
            res.status(500).json({ error: 'Failed to follow user' });
        }
    }
    async unfollowUser(req, res) {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { username } = req.params;
            const success = await usersService.unfollowUser(req.user.userId, username);
            if (!success) {
                res.status(400).json({ error: 'User not found or not following' });
                return;
            }
            res.json({ message: 'User unfollowed successfully' });
        }
        catch (error) {
            middlewares_1.logger.error('Unfollow user error:', error);
            res.status(500).json({ error: 'Failed to unfollow user' });
        }
    }
    async getFollowers(req, res) {
        try {
            const { username } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 20, 50);
            const followers = await usersService.getFollowers(username, page, limit);
            res.json({ followers, page, limit });
        }
        catch (error) {
            middlewares_1.logger.error('Get followers error:', error);
            res.status(500).json({ error: 'Failed to get followers' });
        }
    }
    async getFollowing(req, res) {
        try {
            const { username } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 20, 50);
            const following = await usersService.getFollowing(username, page, limit);
            res.json({ following, page, limit });
        }
        catch (error) {
            middlewares_1.logger.error('Get following error:', error);
            res.status(500).json({ error: 'Failed to get following' });
        }
    }
    async searchUsers(req, res) {
        try {
            const { q } = req.query;
            if (!q || typeof q !== 'string' || !q.trim()) {
                res.status(400).json({ error: 'Query parameter is required' });
                return;
            }
            const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
            const currentUserId = req.user?.userId;
            middlewares_1.logger.info(`[UsersController] Searching users - query: "${q}", limit: ${limit}, userId: ${currentUserId || 'anonymous'}`);
            const users = await usersService.searchUsers(q.trim(), limit, currentUserId);
            if (currentUserId && users.length > 0) {
                const userIds = users.map(u => u.id);
                const followResult = await (0, db_1.query)(`SELECT following_id 
           FROM follows 
           WHERE follower_id = $1 AND following_id = ANY($2::uuid[])`, [currentUserId, userIds]);
                const followingIds = new Set(followResult.rows.map(row => row.following_id));
                users.forEach(user => {
                    user.is_following = followingIds.has(user.id);
                });
            }
            middlewares_1.logger.info(`[UsersController] Found ${users.length} users for query: "${q}"`);
            res.json({ users });
        }
        catch (error) {
            middlewares_1.logger.error('[UsersController] Search users error:', {
                error: error.message,
                stack: error.stack,
                query: req.query.q,
                limit: req.query.limit,
            });
            res.status(500).json({
                error: 'Failed to search users',
                message: process.env.NODE_ENV === 'development' ? error.message : undefined,
            });
        }
    }
    async getAllUsers(req, res) {
        try {
            const limit = Math.min(parseInt(req.query.limit) || 20, 50);
            const offset = parseInt(req.query.offset) || 0;
            const currentUserId = req.user?.userId;
            const users = await usersService.getAllUsers(limit, offset, currentUserId);
            if (currentUserId) {
                for (const user of users) {
                    const followResult = await (0, db_1.query)('SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2', [currentUserId, user.id]);
                    user.is_following = followResult.rows.length > 0;
                }
            }
            res.json({ users });
        }
        catch (error) {
            middlewares_1.logger.error('Get all users error:', error);
            res.status(500).json({ error: 'Failed to get users' });
        }
    }
}
exports.UsersController = UsersController;
//# sourceMappingURL=usersController.js.map