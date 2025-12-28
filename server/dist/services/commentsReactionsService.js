"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactionsService = exports.CommentsService = void 0;
const db_1 = require("../models/db");
const middlewares_1 = require("../middlewares");
class CommentsService {
    async createComment(postId, userId, text, parentCommentId) {
        const result = await (0, db_1.query)(`INSERT INTO comments (post_id, user_id, text, parent_comment_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [postId, userId, text, parentCommentId || null]);
        const comment = result.rows[0];
        const userResult = await (0, db_1.query)(`SELECT id, username, display_name, avatar_url
       FROM users
       WHERE id = $1`, [userId]);
        if (userResult.rows.length > 0) {
            const userData = userResult.rows[0];
            comment.user = {
                id: userData.id,
                username: userData.username,
                display_name: userData.display_name,
                avatar_url: userData.avatar_url,
            };
        }
        const reactionsService = new ReactionsService();
        comment.reactions = await reactionsService.getReactions(undefined, comment.id);
        const userReactionResult = await (0, db_1.query)(`SELECT kind FROM reactions 
       WHERE user_id = $1 AND comment_id = $2 AND post_id IS NULL`, [userId, comment.id]);
        comment.user_reaction = userReactionResult.rows[0]?.kind || undefined;
        middlewares_1.logger.info(`New comment created by user ${userId} on post ${postId}${parentCommentId ? ` (reply to ${parentCommentId})` : ''}`);
        return comment;
    }
    async getPostComments(postId, page = 1, limit = 20, userId) {
        try {
            const offset = (page - 1) * limit;
            const result = await (0, db_1.query)(`SELECT c.*, u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.post_id = $1 AND c.parent_comment_id IS NULL
         ORDER BY c.created_at ASC
         LIMIT $2 OFFSET $3`, [postId, limit, offset]);
            if (result.rows.length === 0) {
                return [];
            }
            const reactionsService = new ReactionsService();
            const commentIds = result.rows.map(row => row.id);
            const reactionsMap = new Map();
            const userReactionsMap = new Map();
            const reactionsResult = await (0, db_1.query)(`SELECT comment_id, kind, COUNT(*) as count
         FROM reactions
         WHERE comment_id = ANY($1::uuid[])
         GROUP BY comment_id, kind`, [commentIds]);
            commentIds.forEach(id => {
                reactionsMap.set(id, {
                    like: 0,
                    love: 0,
                    laugh: 0,
                    wow: 0,
                    sad: 0,
                    angry: 0,
                });
            });
            reactionsResult.rows.forEach(row => {
                const reactions = reactionsMap.get(row.comment_id) || {
                    like: 0,
                    love: 0,
                    laugh: 0,
                    wow: 0,
                    sad: 0,
                    angry: 0,
                };
                reactions[row.kind] = parseInt(row.count, 10);
                reactionsMap.set(row.comment_id, reactions);
            });
            if (userId) {
                const userReactionsResult = await (0, db_1.query)(`SELECT comment_id, kind FROM reactions 
           WHERE user_id = $1 AND comment_id = ANY($2::uuid[]) AND post_id IS NULL`, [userId, commentIds]);
                userReactionsResult.rows.forEach(row => {
                    userReactionsMap.set(row.comment_id, row.kind);
                });
            }
            const repliesCountResult = await (0, db_1.query)(`SELECT parent_comment_id, COUNT(*) as count
         FROM comments
         WHERE parent_comment_id = ANY($1::uuid[])
         GROUP BY parent_comment_id`, [commentIds]);
            const repliesCountMap = new Map();
            repliesCountResult.rows.forEach(row => {
                repliesCountMap.set(row.parent_comment_id, parseInt(row.count, 10));
            });
            const repliesResult = await (0, db_1.query)(`SELECT c.*, u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.parent_comment_id = ANY($1::uuid[])
         ORDER BY c.created_at ASC`, [commentIds]);
            const replyIds = repliesResult.rows.map(row => row.id);
            if (replyIds.length > 0) {
                const replyReactionsResult = await (0, db_1.query)(`SELECT comment_id, kind, COUNT(*) as count
           FROM reactions
           WHERE comment_id = ANY($1::uuid[])
           GROUP BY comment_id, kind`, [replyIds]);
                replyIds.forEach(id => {
                    reactionsMap.set(id, {
                        like: 0,
                        love: 0,
                        laugh: 0,
                        wow: 0,
                        sad: 0,
                        angry: 0,
                    });
                });
                replyReactionsResult.rows.forEach(row => {
                    const reactions = reactionsMap.get(row.comment_id) || {
                        like: 0,
                        love: 0,
                        laugh: 0,
                        wow: 0,
                        sad: 0,
                        angry: 0,
                    };
                    reactions[row.kind] = parseInt(row.count, 10);
                    reactionsMap.set(row.comment_id, reactions);
                });
                if (userId) {
                    const userReplyReactionsResult = await (0, db_1.query)(`SELECT comment_id, kind FROM reactions 
             WHERE user_id = $1 AND comment_id = ANY($2::uuid[]) AND post_id IS NULL`, [userId, replyIds]);
                    userReplyReactionsResult.rows.forEach(row => {
                        userReactionsMap.set(row.comment_id, row.kind);
                    });
                }
            }
            const repliesMap = new Map();
            repliesResult.rows.forEach(row => {
                const reply = {
                    id: row.id,
                    post_id: row.post_id,
                    user_id: row.user_id,
                    parent_comment_id: row.parent_comment_id,
                    text: row.text,
                    created_at: row.created_at,
                    user: {
                        id: row.user_id_for_join,
                        username: row.username,
                        display_name: row.display_name,
                        avatar_url: row.avatar_url,
                    },
                    reactions: reactionsMap.get(row.id) || {
                        like: 0,
                        love: 0,
                        laugh: 0,
                        wow: 0,
                        sad: 0,
                        angry: 0,
                    },
                    user_reaction: userReactionsMap.get(row.id),
                };
                const parentId = row.parent_comment_id;
                if (!repliesMap.has(parentId)) {
                    repliesMap.set(parentId, []);
                }
                repliesMap.get(parentId).push(reply);
            });
            return result.rows.map(row => {
                const commentId = row.id;
                const comment = {
                    id: commentId,
                    post_id: row.post_id,
                    user_id: row.user_id,
                    parent_comment_id: row.parent_comment_id,
                    text: row.text,
                    created_at: row.created_at,
                    user: {
                        id: row.user_id_for_join,
                        username: row.username,
                        display_name: row.display_name,
                        avatar_url: row.avatar_url,
                    },
                    reactions: reactionsMap.get(commentId) || {
                        like: 0,
                        love: 0,
                        laugh: 0,
                        wow: 0,
                        sad: 0,
                        angry: 0,
                    },
                    user_reaction: userReactionsMap.get(commentId),
                    replies: repliesMap.get(commentId) || [],
                    replies_count: repliesCountMap.get(commentId) || 0,
                };
                return comment;
            });
        }
        catch (error) {
            middlewares_1.logger.error('Error fetching post comments:', error);
            throw error;
        }
    }
    async deleteComment(commentId, userId) {
        const result = await (0, db_1.query)('DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING id', [commentId, userId]);
        if (result.rows.length > 0) {
            middlewares_1.logger.info(`Comment ${commentId} deleted by user ${userId}`);
            return true;
        }
        return false;
    }
}
exports.CommentsService = CommentsService;
class ReactionsService {
    async addReaction(userId, kind, postId, commentId) {
        if (!postId && !commentId) {
            throw new Error('Either postId or commentId must be provided');
        }
        let deleteResult;
        if (postId) {
            deleteResult = await (0, db_1.query)(`DELETE FROM reactions 
         WHERE user_id = $1 
           AND post_id = $2 
           AND comment_id IS NULL`, [userId, postId]);
            middlewares_1.logger.info(`Deleted ${deleteResult?.rowCount || 0} existing reaction(s) for user ${userId} on post ${postId}`);
        }
        else if (commentId) {
            deleteResult = await (0, db_1.query)(`DELETE FROM reactions 
         WHERE user_id = $1 
           AND comment_id = $2 
           AND post_id IS NULL`, [userId, commentId]);
            middlewares_1.logger.info(`Deleted ${deleteResult?.rowCount || 0} existing reaction(s) for user ${userId} on comment ${commentId}`);
        }
        const result = await (0, db_1.query)(`INSERT INTO reactions (user_id, kind, post_id, comment_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, post_id, comment_id)
       DO UPDATE SET 
         kind = EXCLUDED.kind,
         created_at = NOW()
       RETURNING *`, [userId, kind, postId || null, commentId || null]);
        const reaction = result.rows[0];
        middlewares_1.logger.info(`Reaction ${kind} added by user ${userId}`);
        return reaction;
    }
    async removeReaction(userId, postId, commentId) {
        const result = await (0, db_1.query)('DELETE FROM reactions WHERE user_id = $1 AND post_id = $2 AND comment_id = $3 RETURNING id', [userId, postId || null, commentId || null]);
        if (result.rows.length > 0) {
            middlewares_1.logger.info(`Reaction removed by user ${userId}`);
            return true;
        }
        return false;
    }
    async getReactions(postId, commentId) {
        const result = await (0, db_1.query)(`SELECT kind, COUNT(*) as count
       FROM reactions
       WHERE post_id = $1 AND comment_id = $2
       GROUP BY kind`, [postId || null, commentId || null]);
        const reactions = {
            like: 0,
            love: 0,
            laugh: 0,
            wow: 0,
            sad: 0,
            angry: 0,
        };
        result.rows.forEach(row => {
            reactions[row.kind] = parseInt(row.count);
        });
        return reactions;
    }
    async getReactionUsers(postId, kind, limit = 50, offset = 0) {
        let queryText = `
      SELECT 
        r.user_id,
        r.kind,
        r.created_at,
        u.username,
        u.display_name,
        u.avatar_url
      FROM reactions r
      JOIN users u ON r.user_id = u.id
      WHERE r.post_id = $1 AND r.comment_id IS NULL
    `;
        const params = [postId];
        if (kind) {
            queryText += ` AND r.kind = $2`;
            params.push(kind);
            queryText += ` ORDER BY r.created_at DESC LIMIT $3 OFFSET $4`;
            params.push(limit, offset);
        }
        else {
            queryText += ` ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`;
            params.push(limit, offset);
        }
        const result = await (0, db_1.query)(queryText, params);
        return result.rows.map(row => ({
            user_id: row.user_id,
            username: row.username,
            display_name: row.display_name,
            avatar_url: row.avatar_url,
            kind: row.kind,
            created_at: row.created_at,
        }));
    }
}
exports.ReactionsService = ReactionsService;
//# sourceMappingURL=commentsReactionsService.js.map