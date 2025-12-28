import { Request, Response } from 'express';
import { z } from 'zod';
import { ReelsService, CreateReelData, UpdateReelData } from '../services/reelsService';
// import { AuthenticatedRequest } from '../middlewares/auth';
import { logger } from '../middlewares';

const reelsService = new ReelsService();

const createReelSchema = z.object({
  video_url: z.string().url('Invalid video URL'),
  thumbnail_url: z.string().url('Invalid thumbnail URL').optional(),
  caption: z.string().max(500, 'Caption must be less than 500 characters').optional(),
  duration_sec: z.number().int().min(1).max(300, 'Duration must be between 1 and 300 seconds').optional()
});

const updateReelSchema = z.object({
  caption: z.string().max(500, 'Caption must be less than 500 characters').optional()
});

export class ReelsController {
  async createReel(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const validatedData = createReelSchema.parse(req.body);
      
      const reel = await reelsService.createReel((req as any).user.userId, validatedData as CreateReelData);
      
      res.status(201).json({ reel });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: 'Validation failed', 
          details: error.errors 
        });
        return;
      }
      
      logger.error('Create reel error:', error);
      res.status(500).json({ error: 'Failed to create reel' });
    }
  }

  async getReels(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      
      const reels = await reelsService.getReels(page, limit);
      
      res.json({ reels, page, limit });
    } catch (error) {
      logger.error('Get reels error:', error);
      res.status(500).json({ error: 'Failed to get reels' });
    }
  }

  async getReel(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      
      const reel = await reelsService.getReelById(id, userId);
      
      if (!reel) {
        res.status(404).json({ error: 'Reel not found' });
        return;
      }
      
      res.json({ reel });
    } catch (error) {
      logger.error('Get reel error:', error);
      res.status(500).json({ error: 'Failed to get reel' });
    }
  }

  async updateReel(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      const validatedData = updateReelSchema.parse(req.body);
      
      const reel = await reelsService.updateReel(id, (req as any).user.userId, validatedData as UpdateReelData);
      
      if (!reel) {
        res.status(404).json({ error: 'Reel not found or access denied' });
        return;
      }
      
      res.json({ reel });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: 'Validation failed', 
          details: error.errors 
        });
        return;
      }
      
      logger.error('Update reel error:', error);
      res.status(500).json({ error: 'Failed to update reel' });
    }
  }

  async deleteReel(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      
      const deleted = await reelsService.deleteReel(id, (req as any).user.userId);
      
      if (!deleted) {
        res.status(404).json({ error: 'Reel not found or access denied' });
        return;
      }
      
      res.json({ message: 'Reel deleted successfully' });
    } catch (error) {
      logger.error('Delete reel error:', error);
      res.status(500).json({ error: 'Failed to delete reel' });
    }
  }

  async incrementViews(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      
      await reelsService.incrementViews(id, userId, req.ip);
      
      res.json({ message: 'View recorded' });
    } catch (error) {
      logger.error('Increment views error:', error);
      res.status(500).json({ error: 'Failed to record view' });
    }
  }

  async getUserReels(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      
      const reels = await reelsService.getUserReels(username, page, limit);
      
      res.json({ reels, page, limit });
    } catch (error) {
      logger.error('Get user reels error:', error);
      res.status(500).json({ error: 'Failed to get user reels' });
    }
  }
}
