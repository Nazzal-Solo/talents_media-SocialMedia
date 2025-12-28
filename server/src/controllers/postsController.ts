import { Request, Response } from 'express';
import { z } from 'zod';
import {
  PostsService,
  Post,
  CreatePostData,
  UpdatePostData,
} from '../services/postsService';
// import { AuthenticatedRequest } from '../middlewares/auth';
import { logger } from '../middlewares';

const postsService = new PostsService();

const createPostSchema = z.object({
  text: z
    .string()
    .max(2000, 'Post text must be less than 2000 characters')
    .optional(),
  media_url: z.string().url('Invalid media URL').optional(),
  media_type: z.enum(['image', 'video', 'none'], {
    errorMap: () => ({ message: 'Media type must be image, video, or none' }),
  }),
  visibility: z.enum(['public', 'followers', 'private'], {
    errorMap: () => ({
      message: 'Visibility must be public, followers, or private',
    }),
  }),
  feeling: z.string().max(100).optional(),
  location: z.string().max(500).optional(),
});

const updatePostSchema = z.object({
  text: z
    .string()
    .max(2000, 'Post text must be less than 2000 characters')
    .optional(),
  media_url: z.string().url('Invalid media URL').optional(),
  media_type: z.enum(['image', 'video', 'none']).optional(),
  visibility: z
    .enum(['public', 'followers', 'private'], {
      errorMap: () => ({
        message: 'Visibility must be public, followers, or private',
      }),
    })
    .optional(),
  feeling: z.string().max(100).optional(),
  location: z.string().max(500).optional(),
});

export class PostsController {
  async createPost(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const validatedData = createPostSchema.parse(req.body);

      const post = await postsService.createPost(
        user.userId,
        validatedData as CreatePostData
      );

      res.status(201).json({ post });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      logger.error('Create post error:', error);
      res.status(500).json({ error: 'Failed to create post' });
    }
  }

  async getFeed(req: Request, res: Response): Promise<void> {
    // ========================================
    // DEBUG: Feed route handler was hit!
    // ========================================
    console.log('🔵 [FEED ROUTE HIT] GET /api/posts/feed handler started at', new Date().toISOString());
    logger.info('🔵 [FEED ROUTE HIT] GET /api/posts/feed handler started');
    
    const startTime = Date.now();
    
    try {
      // Step 1: Get user from request
      const user = (req as any).user;
      logger.info('[PostsController] getFeed - Step 1: User check', { hasUser: !!user });
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      // Step 2: Parse query params
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      logger.info('[PostsController] getFeed - Step 2: Query params', { page, limit, userId: user.userId });

      // Step 3: Call service
      logger.info('[PostsController] getFeed - Step 3: Calling postsService.getFeed');
      const serviceStartTime = Date.now();
      
      // TEMPORARY: Add timeout safeguard - if service takes > 15 seconds, return empty array
      // This prevents the request from hanging indefinitely
      const posts = await Promise.race([
        postsService.getFeed(user.userId, page, limit),
        new Promise<Post[]>((resolve) => {
          setTimeout(() => {
            logger.error('[PostsController] getFeed - TIMEOUT: Service took > 15s, returning empty');
            resolve([]);
          }, 15000);
        }),
      ]);
      
      const serviceDuration = Date.now() - serviceStartTime;
      logger.info('[PostsController] getFeed - Step 4: Service returned', { 
        postCount: posts.length, 
        serviceDuration: `${serviceDuration}ms` 
      });

      // Step 5: Send response
      const totalDuration = Date.now() - startTime;
      console.log('🟢 [FEED ROUTE] About to send response', { 
        totalDuration: `${totalDuration}ms`,
        postCount: posts.length 
      });
      logger.info('[PostsController] getFeed - Step 5: Sending response', { 
        totalDuration: `${totalDuration}ms`,
        postCount: posts.length 
      });
      
      if (totalDuration > 2000) {
        logger.warn(`[PostsController] getFeed took ${totalDuration}ms for user ${user.userId}, page ${page}`);
      }

      res.json({ posts, page, limit });
      console.log('✅ [FEED ROUTE] Response sent successfully');
    } catch (error: any) {
      const duration = Date.now() - startTime;
      // Log full error details for debugging
      console.error('🔴 [FEED ROUTE ERROR] Full error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        duration: `${duration}ms`,
        error: error, // Full error object
      });
      logger.error('[PostsController] getFeed - ERROR:', {
        error: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        duration: `${duration}ms`,
      });
      res.status(500).json({ error: 'Failed to get feed' });
    }
  }

  async getExplore(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    console.log('🔵 [EXPLORE ROUTE HIT] GET /api/posts/explore handler started at', new Date().toISOString());
    
    try {
      const user = (req as any).user;
      const userId = user?.userId; // Optional - can be undefined for anonymous users
      console.log('🔵 [EXPLORE ROUTE] User check', { hasUser: !!user, userId });

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      console.log('🔵 [EXPLORE ROUTE] Query params', { page, limit });

      console.log('🔵 [EXPLORE ROUTE] Calling postsService.getExplore');
      const posts = await postsService.getExplore(userId, page, limit);
      console.log('🟢 [EXPLORE ROUTE] Service returned', { postCount: posts.length });

      const duration = Date.now() - startTime;
      console.log('✅ [EXPLORE ROUTE] Sending response', { duration: `${duration}ms`, postCount: posts.length });
      res.json({ posts, page, limit });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      // Log full error details for debugging
      console.error('🔴 [EXPLORE ROUTE ERROR] Full error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        duration: `${duration}ms`,
        error: error, // Full error object
      });
      logger.error('Get explore error:', {
        error: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        duration: `${duration}ms`,
      });
      res.status(500).json({ error: 'Failed to get explore feed' });
    }
  }

  async getPost(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;

      const post = await postsService.getPostById(id, userId);

      if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return;
      }

      res.json({ post });
    } catch (error) {
      logger.error('Get post error:', error);
      res.status(500).json({ error: 'Failed to get post' });
    }
  }

  async updatePost(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      const validatedData = updatePostSchema.parse(req.body);

      const post = await postsService.updatePost(
        id,
        user.userId,
        validatedData as UpdatePostData
      );

      if (!post) {
        res.status(404).json({ error: 'Post not found or access denied' });
        return;
      }

      res.json({ post });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      logger.error('Update post error:', error);
      res.status(500).json({ error: 'Failed to update post' });
    }
  }

  async deletePost(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;

      const deleted = await postsService.deletePost(id, user.userId);

      if (!deleted) {
        res.status(404).json({ error: 'Post not found or access denied' });
        return;
      }

      res.json({ message: 'Post deleted successfully' });
    } catch (error) {
      logger.error('Delete post error:', error);
      res.status(500).json({ error: 'Failed to delete post' });
    }
  }

  async getUserPosts(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

      const posts = await postsService.getUserPosts(username, page, limit);

      res.json({ posts, page, limit });
    } catch (error) {
      logger.error('Get user posts error:', error);
      res.status(500).json({ error: 'Failed to get user posts' });
    }
  }

  async getTrendingHashtags(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

      const hashtags = await postsService.getTrendingHashtags(limit);

      res.json({ hashtags });
    } catch (error) {
      logger.error('Get trending hashtags error:', error);
      res.status(500).json({ error: 'Failed to get trending hashtags' });
    }
  }

  async hidePost(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      const success = await postsService.hidePost(user.userId, id);

      if (!success) {
        res.status(500).json({ error: 'Failed to hide post' });
        return;
      }

      res.json({ message: 'Post hidden successfully' });
    } catch (error) {
      logger.error('Hide post error:', error);
      res.status(500).json({ error: 'Failed to hide post' });
    }
  }

  async reportPost(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      const { reason, description } = req.body;

      const success = await postsService.reportPost(
        user.userId,
        id,
        reason,
        description
      );

      if (!success) {
        res.status(500).json({ error: 'Failed to report post' });
        return;
      }

      res.json({ message: 'Post reported successfully' });
    } catch (error) {
      logger.error('Report post error:', error);
      res.status(500).json({ error: 'Failed to report post' });
    }
  }

  async markNotInterested(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      const success = await postsService.markNotInterested(user.userId, id);

      if (!success) {
        res
          .status(500)
          .json({ error: 'Failed to mark post as not interested' });
        return;
      }

      res.json({ message: 'Post marked as not interested' });
    } catch (error) {
      logger.error('Not interested post error:', error);
      res.status(500).json({ error: 'Failed to mark post as not interested' });
    }
  }

  async searchPosts(req: Request, res: Response): Promise<void> {
    try {
      const { q } = req.query;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 50);
      const userId = (req as any).user?.userId;
      const mediaType = req.query.mediaType as 'image' | 'video' | undefined;

      // If mediaType is specified but no query, allow searching all posts with that media type
      const searchQuery = (q && typeof q === 'string' && q.trim() && q !== '*') 
        ? q.trim()
        : mediaType 
          ? '' 
          : null;

      if (!searchQuery && !mediaType) {
        res.status(400).json({ error: 'Query parameter is required' });
        return;
      }

      logger.info(`[PostsController] Searching posts - query: "${searchQuery || '(empty)'}", limit: ${limit}, mediaType: ${mediaType}, userId: ${userId || 'anonymous'}`);
      
      const posts = await postsService.searchPosts(searchQuery || '', userId, limit, mediaType);
      
      logger.info(`[PostsController] Found ${posts.length} posts for query: "${searchQuery || '(empty)'}"`);

      res.json({ posts });
    } catch (error: any) {
      logger.error('[PostsController] Search posts error:', {
        error: error.message,
        stack: error.stack,
        query: req.query.q,
        limit: req.query.limit,
        mediaType: req.query.mediaType,
      });
      res.status(500).json({ 
        error: 'Failed to search posts',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
}
