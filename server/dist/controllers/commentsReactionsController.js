"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactionsController = exports.CommentsController = void 0;
const zod_1 = require("zod");
const commentsReactionsService_1 = require("../services/commentsReactionsService");
const middlewares_1 = require("../middlewares");
const commentsService = new commentsReactionsService_1.CommentsService();
const reactionsService = new commentsReactionsService_1.ReactionsService();
const createCommentSchema = zod_1.z.object({
    text: zod_1.z
        .string()
        .min(1)
        .max(1000, 'Comment must be less than 1000 characters'),
});
const addReactionSchema = zod_1.z.object({
    kind: zod_1.z.enum(['like', 'love', 'laugh', 'wow', 'sad', 'angry'], {
        errorMap: () => ({ message: 'Invalid reaction type' }),
    }),
});
class CommentsController {
    async createComment(req, res) {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { postId } = req.params;
            const validatedData = createCommentSchema.parse(req.body);
            const parentCommentId = req.body.parent_comment_id || null;
            const comment = await commentsService.createComment(postId, req.user.userId, validatedData.text, parentCommentId);
            res.status(201).json({ comment });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors,
                });
                return;
            }
            middlewares_1.logger.error('Create comment error:', error);
            res.status(500).json({ error: 'Failed to create comment' });
        }
    }
    async getPostComments(req, res) {
        try {
            const { postId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 20, 50);
            const user = req.user;
            const userId = user?.userId;
            const comments = await commentsService.getPostComments(postId, page, limit, userId);
            res.json({ comments, page, limit });
        }
        catch (error) {
            middlewares_1.logger.error('Get comments error:', error);
            res.status(500).json({ error: 'Failed to get comments' });
        }
    }
    async deleteComment(req, res) {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            const deleted = await commentsService.deleteComment(id, req.user.userId);
            if (!deleted) {
                res.status(404).json({ error: 'Comment not found or access denied' });
                return;
            }
            res.json({ message: 'Comment deleted successfully' });
        }
        catch (error) {
            middlewares_1.logger.error('Delete comment error:', error);
            res.status(500).json({ error: 'Failed to delete comment' });
        }
    }
}
exports.CommentsController = CommentsController;
class ReactionsController {
    async addReaction(req, res) {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { postId, commentId } = req.params;
            const validatedData = addReactionSchema.parse(req.body);
            const reaction = await reactionsService.addReaction(req.user.userId, validatedData.kind, postId || undefined, commentId || undefined);
            res.status(201).json({ reaction });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors,
                });
                return;
            }
            middlewares_1.logger.error('Add reaction error:', error);
            res.status(500).json({ error: 'Failed to add reaction' });
        }
    }
    async removeReaction(req, res) {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { postId, commentId } = req.params;
            const removed = await reactionsService.removeReaction(req.user.userId, postId || undefined, commentId || undefined);
            res.json({
                message: removed
                    ? 'Reaction removed successfully'
                    : 'Reaction not found (already removed or never existed)'
            });
        }
        catch (error) {
            middlewares_1.logger.error('Remove reaction error:', error);
            res.status(500).json({ error: 'Failed to remove reaction' });
        }
    }
    async getReactionUsers(req, res) {
        try {
            const { postId } = req.params;
            const kind = req.query.kind;
            const limit = Math.min(parseInt(req.query.limit) || 50, 100);
            const offset = parseInt(req.query.offset) || 0;
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const users = await reactionsService.getReactionUsers(postId, kind, limit, offset);
            res.json({ users, limit, offset });
        }
        catch (error) {
            middlewares_1.logger.error('Get reaction users error:', error);
            res.status(500).json({ error: 'Failed to get reaction users' });
        }
    }
}
exports.ReactionsController = ReactionsController;
//# sourceMappingURL=commentsReactionsController.js.map