import { Request, Response } from 'express';
import { z } from 'zod';
import { UsersService, UpdateProfileData } from '../services/usersService';
// import { AuthenticatedRequest } from '../middlewares/auth';
import { logger } from '../middlewares';
import { query } from '../models/db';

const usersService = new UsersService();

const updateProfileSchema = z.object({
  display_name: z
    .string()
    .min(1)
    .max(100, 'Display name must be less than 100 characters')
    .optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  location: z
    .string()
    .max(100, 'Location must be less than 100 characters')
    .optional(),
  theme_pref: z
    .enum(['dark-neon', 'light', 'cyan', 'magenta', 'violet'], {
      errorMap: () => ({ message: 'Invalid theme preference' }),
    })
    .optional(),
});

export class UsersController {
  async getMe(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const userData = await usersService.getUserById((req as any).user.userId);

      if (!userData) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ user: userData });
    } catch (error) {
      logger.error('Get me error:', error);
      res.status(500).json({ error: 'Failed to get user data' });
    }
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const validatedData = updateProfileSchema.parse(req.body);

      const updatedUser = await usersService.updateProfile(
        (req as any).user.userId,
        validatedData as UpdateProfileData
      );

      if (!updatedUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ user: updatedUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      logger.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  async getUserProfile(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.params;
      const currentUserId = (req as any).user?.userId;

      const profile = await usersService.getUserProfile(
        username,
        currentUserId
      );

      if (!profile) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ profile });
    } catch (error) {
      logger.error('Get user profile error:', error);
      res.status(500).json({ error: 'Failed to get user profile' });
    }
  }

  async followUser(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { username } = req.params;

      if (username === (req as any).user.username) {
        res.status(400).json({ error: 'Cannot follow yourself' });
        return;
      }

      const success = await usersService.followUser(
        (req as any).user.userId,
        username
      );

      if (!success) {
        res.status(400).json({ error: 'User not found or already following' });
        return;
      }

      res.json({ message: 'User followed successfully' });
    } catch (error) {
      logger.error('Follow user error:', error);
      res.status(500).json({ error: 'Failed to follow user' });
    }
  }

  async unfollowUser(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { username } = req.params;

      const success = await usersService.unfollowUser(
        (req as any).user.userId,
        username
      );

      if (!success) {
        res.status(400).json({ error: 'User not found or not following' });
        return;
      }

      res.json({ message: 'User unfollowed successfully' });
    } catch (error) {
      logger.error('Unfollow user error:', error);
      res.status(500).json({ error: 'Failed to unfollow user' });
    }
  }

  async getFollowers(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

      const followers = await usersService.getFollowers(username, page, limit);

      res.json({ followers, page, limit });
    } catch (error) {
      logger.error('Get followers error:', error);
      res.status(500).json({ error: 'Failed to get followers' });
    }
  }

  async getFollowing(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

      const following = await usersService.getFollowing(username, page, limit);

      res.json({ following, page, limit });
    } catch (error) {
      logger.error('Get following error:', error);
      res.status(500).json({ error: 'Failed to get following' });
    }
  }

  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string' || !q.trim()) {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 50);
      const currentUserId = (req as any).user?.userId;

      logger.info(`[UsersController] Searching users - query: "${q}", limit: ${limit}, userId: ${currentUserId || 'anonymous'}`);

      const users = await usersService.searchUsers(q.trim(), limit, currentUserId);

      // Add is_following status if authenticated
      if (currentUserId && users.length > 0) {
        const userIds = users.map(u => u.id);
        const followResult = await query(
          `SELECT following_id 
           FROM follows 
           WHERE follower_id = $1 AND following_id = ANY($2::uuid[])`,
          [currentUserId, userIds]
        );
        
        const followingIds = new Set(followResult.rows.map(row => row.following_id));
        users.forEach(user => {
          user.is_following = followingIds.has(user.id);
        });
      }

      logger.info(`[UsersController] Found ${users.length} users for query: "${q}"`);

      res.json({ users });
    } catch (error: any) {
      logger.error('[UsersController] Search users error:', {
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

  async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const offset = parseInt(req.query.offset as string) || 0;
      const currentUserId = (req as any).user?.userId;

      const users = await usersService.getAllUsers(limit, offset, currentUserId);

      // Add is_following status if authenticated
      if (currentUserId) {
        for (const user of users) {
          const followResult = await query(
            'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
            [currentUserId, user.id]
          );
          user.is_following = followResult.rows.length > 0;
        }
      }

      res.json({ users });
    } catch (error) {
      logger.error('Get all users error:', error);
      res.status(500).json({ error: 'Failed to get users' });
    }
  }
}
