import { Request, Response } from 'express';
import { z } from 'zod';
import {
  CommentsService,
  ReactionsService,
} from '../services/commentsReactionsService';
// import { AuthenticatedRequest } from '../middlewares/auth';
import { logger } from '../middlewares';

const commentsService = new CommentsService();
const reactionsService = new ReactionsService();

const createCommentSchema = z.object({
  text: z
    .string()
    .min(1)
    .max(1000, 'Comment must be less than 1000 characters'),
});

const addReactionSchema = z.object({
  kind: z.enum(['like', 'love', 'laugh', 'wow', 'sad', 'angry'], {
    errorMap: () => ({ message: 'Invalid reaction type' }),
  }),
});

export class CommentsController {
  async createComment(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { postId } = req.params;
      const validatedData = createCommentSchema.parse(req.body);
      const parentCommentId = req.body.parent_comment_id || null;

      const comment = await commentsService.createComment(
        postId,
        (req as any).user.userId,
        validatedData.text,
        parentCommentId
      );

      res.status(201).json({ comment });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      logger.error('Create comment error:', error);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  }

  async getPostComments(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const user = (req as any).user;
      const userId = user?.userId;

      const comments = await commentsService.getPostComments(
        postId,
        page,
        limit,
        userId
      );

      res.json({ comments, page, limit });
    } catch (error) {
      logger.error('Get comments error:', error);
      res.status(500).json({ error: 'Failed to get comments' });
    }
  }

  async deleteComment(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;

      const deleted = await commentsService.deleteComment(
        id,
        (req as any).user.userId
      );

      if (!deleted) {
        res.status(404).json({ error: 'Comment not found or access denied' });
        return;
      }

      res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
      logger.error('Delete comment error:', error);
      res.status(500).json({ error: 'Failed to delete comment' });
    }
  }
}

export class ReactionsController {
  async addReaction(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { postId, commentId } = req.params;
      const validatedData = addReactionSchema.parse(req.body);

      const reaction = await reactionsService.addReaction(
        (req as any).user.userId,
        validatedData.kind,
        postId || undefined,
        commentId || undefined
      );

      res.status(201).json({ reaction });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }

      logger.error('Add reaction error:', error);
      res.status(500).json({ error: 'Failed to add reaction' });
    }
  }

  async removeReaction(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { postId, commentId } = req.params;

      const removed = await reactionsService.removeReaction(
        (req as any).user.userId,
        postId || undefined,
        commentId || undefined
      );

      // Make DELETE idempotent: return success even if reaction doesn't exist
      // This prevents 404 errors when the reaction was already removed or never existed
      res.json({ 
        message: removed 
          ? 'Reaction removed successfully' 
          : 'Reaction not found (already removed or never existed)'
      });
    } catch (error) {
      logger.error('Remove reaction error:', error);
      res.status(500).json({ error: 'Failed to remove reaction' });
    }
  }

  async getReactionUsers(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const kind = req.query.kind as 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry' | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      // Check post visibility (user must be authenticated to see reactions)
      // Note: In a real app, you'd check if the user can see the post
      // For now, we'll allow authenticated users to see reactions
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const users = await reactionsService.getReactionUsers(
        postId,
        kind,
        limit,
        offset
      );

      res.json({ users, limit, offset });
    } catch (error) {
      logger.error('Get reaction users error:', error);
      res.status(500).json({ error: 'Failed to get reaction users' });
    }
  }
}
