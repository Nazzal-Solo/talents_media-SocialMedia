"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReelsService = void 0;
const db_1 = require("../models/db");
const middlewares_1 = require("../middlewares");
class ReelsService {
    async createReel(userId, data) {
        const result = await (0, db_1.query)(`INSERT INTO reels (user_id, video_url, thumbnail_url, caption, duration_sec)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`, [userId, data.video_url, data.thumbnail_url, data.caption, data.duration_sec]);
        const reel = result.rows[0];
        middlewares_1.logger.info(`New reel created by user ${userId}: ${reel.id}`);
        return reel;
    }
    async getReels(page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const result = await (0, db_1.query)(`SELECT r.*, u.username, u.display_name, u.avatar_url
       FROM reels r
       JOIN users u ON r.user_id = u.id
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`, [limit, offset]);
        const reels = result.rows;
        for (const reel of reels) {
            const reactionsResult = await (0, db_1.query)(`SELECT kind, COUNT(*) as count
         FROM reactions
         WHERE reel_id = $1
         GROUP BY kind`, [reel.id]);
            const reactions = {
                like: 0, love: 0, laugh: 0, wow: 0, sad: 0, angry: 0
            };
            reactionsResult.rows.forEach(row => {
                reactions[row.kind] = parseInt(row.count);
            });
            reel.reactions = reactions;
            const commentsResult = await (0, db_1.query)('SELECT COUNT(*) as count FROM comments WHERE reel_id = $1', [reel.id]);
            reel.comments_count = parseInt(commentsResult.rows[0].count);
        }
        return reels;
    }
    async getReelById(reelId, userId) {
        const result = await (0, db_1.query)(`SELECT r.*, u.username, u.display_name, u.avatar_url
       FROM reels r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`, [reelId]);
        if (result.rows.length === 0) {
            return null;
        }
        const reel = result.rows[0];
        const reactionsResult = await (0, db_1.query)(`SELECT kind, COUNT(*) as count
       FROM reactions
       WHERE reel_id = $1
       GROUP BY kind`, [reelId]);
        const reactions = {
            like: 0, love: 0, laugh: 0, wow: 0, sad: 0, angry: 0
        };
        reactionsResult.rows.forEach(row => {
            reactions[row.kind] = parseInt(row.count);
        });
        reel.reactions = reactions;
        const commentsResult = await (0, db_1.query)('SELECT COUNT(*) as count FROM comments WHERE reel_id = $1', [reelId]);
        reel.comments_count = parseInt(commentsResult.rows[0].count);
        if (userId) {
            const userReactionResult = await (0, db_1.query)('SELECT kind FROM reactions WHERE reel_id = $1 AND user_id = $2', [reelId, userId]);
            reel.user_reaction = userReactionResult.rows[0]?.kind;
        }
        return reel;
    }
    async updateReel(reelId, userId, data) {
        const ownershipResult = await (0, db_1.query)('SELECT id FROM reels WHERE id = $1 AND user_id = $2', [reelId, userId]);
        if (ownershipResult.rows.length === 0) {
            return null;
        }
        const result = await (0, db_1.query)(`UPDATE reels 
       SET caption = COALESCE($1, caption),
           updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`, [data.caption, reelId, userId]);
        return result.rows[0];
    }
    async deleteReel(reelId, userId) {
        const result = await (0, db_1.query)('DELETE FROM reels WHERE id = $1 AND user_id = $2 RETURNING id', [reelId, userId]);
        if (result.rows.length > 0) {
            middlewares_1.logger.info(`Reel ${reelId} deleted by user ${userId}`);
            return true;
        }
        return false;
    }
    async incrementViews(reelId, userId, ip) {
        await (0, db_1.query)('UPDATE reels SET views_count = views_count + 1 WHERE id = $1', [reelId]);
        await (0, db_1.query)(`INSERT INTO views (user_id, reel_id, ip)
       VALUES ($1, $2, $3)`, [userId || null, reelId, ip || null]);
    }
    async getUserReels(username, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const result = await (0, db_1.query)(`SELECT r.*, u.username, u.display_name, u.avatar_url
       FROM reels r
       JOIN users u ON r.user_id = u.id
       WHERE u.username = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`, [username, limit, offset]);
        return result.rows;
    }
}
exports.ReelsService = ReelsService;
//# sourceMappingURL=reelsService.js.map