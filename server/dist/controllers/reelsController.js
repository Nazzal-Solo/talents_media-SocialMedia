"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReelsController = void 0;
const zod_1 = require("zod");
const reelsService_1 = require("../services/reelsService");
const middlewares_1 = require("../middlewares");
const reelsService = new reelsService_1.ReelsService();
const createReelSchema = zod_1.z.object({
    video_url: zod_1.z.string().url('Invalid video URL'),
    thumbnail_url: zod_1.z.string().url('Invalid thumbnail URL').optional(),
    caption: zod_1.z.string().max(500, 'Caption must be less than 500 characters').optional(),
    duration_sec: zod_1.z.number().int().min(1).max(300, 'Duration must be between 1 and 300 seconds').optional()
});
const updateReelSchema = zod_1.z.object({
    caption: zod_1.z.string().max(500, 'Caption must be less than 500 characters').optional()
});
class ReelsController {
    async createReel(req, res) {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const validatedData = createReelSchema.parse(req.body);
            const reel = await reelsService.createReel(req.user.userId, validatedData);
            res.status(201).json({ reel });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors
                });
                return;
            }
            middlewares_1.logger.error('Create reel error:', error);
            res.status(500).json({ error: 'Failed to create reel' });
        }
    }
    async getReels(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 20, 50);
            const reels = await reelsService.getReels(page, limit);
            res.json({ reels, page, limit });
        }
        catch (error) {
            middlewares_1.logger.error('Get reels error:', error);
            res.status(500).json({ error: 'Failed to get reels' });
        }
    }
    async getReel(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            const reel = await reelsService.getReelById(id, userId);
            if (!reel) {
                res.status(404).json({ error: 'Reel not found' });
                return;
            }
            res.json({ reel });
        }
        catch (error) {
            middlewares_1.logger.error('Get reel error:', error);
            res.status(500).json({ error: 'Failed to get reel' });
        }
    }
    async updateReel(req, res) {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            const validatedData = updateReelSchema.parse(req.body);
            const reel = await reelsService.updateReel(id, req.user.userId, validatedData);
            if (!reel) {
                res.status(404).json({ error: 'Reel not found or access denied' });
                return;
            }
            res.json({ reel });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors
                });
                return;
            }
            middlewares_1.logger.error('Update reel error:', error);
            res.status(500).json({ error: 'Failed to update reel' });
        }
    }
    async deleteReel(req, res) {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            const deleted = await reelsService.deleteReel(id, req.user.userId);
            if (!deleted) {
                res.status(404).json({ error: 'Reel not found or access denied' });
                return;
            }
            res.json({ message: 'Reel deleted successfully' });
        }
        catch (error) {
            middlewares_1.logger.error('Delete reel error:', error);
            res.status(500).json({ error: 'Failed to delete reel' });
        }
    }
    async incrementViews(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.userId;
            await reelsService.incrementViews(id, userId, req.ip);
            res.json({ message: 'View recorded' });
        }
        catch (error) {
            middlewares_1.logger.error('Increment views error:', error);
            res.status(500).json({ error: 'Failed to record view' });
        }
    }
    async getUserReels(req, res) {
        try {
            const { username } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 20, 50);
            const reels = await reelsService.getUserReels(username, page, limit);
            res.json({ reels, page, limit });
        }
        catch (error) {
            middlewares_1.logger.error('Get user reels error:', error);
            res.status(500).json({ error: 'Failed to get user reels' });
        }
    }
}
exports.ReelsController = ReelsController;
//# sourceMappingURL=reelsController.js.map