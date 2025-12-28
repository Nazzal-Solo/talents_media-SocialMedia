import { query } from '../models/db';
import { logger } from '../middlewares';

export interface Reel {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  duration_sec?: number;
  views_count: number;
  created_at: Date;
  user?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  reactions?: {
    like: number;
    love: number;
    laugh: number;
    wow: number;
    sad: number;
    angry: number;
  };
  comments_count?: number;
  user_reaction?: string;
}

export interface CreateReelData {
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  duration_sec?: number;
}

export interface UpdateReelData {
  caption?: string;
}

export class ReelsService {
  async createReel(userId: string, data: CreateReelData): Promise<Reel> {
    const result = await query(
      `INSERT INTO reels (user_id, video_url, thumbnail_url, caption, duration_sec)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, data.video_url, data.thumbnail_url, data.caption, data.duration_sec]
    );

    const reel = result.rows[0] as Reel;
    logger.info(`New reel created by user ${userId}: ${reel.id}`);
    return reel;
  }

  async getReels(page: number = 1, limit: number = 20): Promise<Reel[]> {
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT r.*, u.username, u.display_name, u.avatar_url
       FROM reels r
       JOIN users u ON r.user_id = u.id
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const reels = result.rows as Reel[];

    // Get reactions and comments for each reel
    for (const reel of reels) {
      const reactionsResult = await query(
        `SELECT kind, COUNT(*) as count
         FROM reactions
         WHERE reel_id = $1
         GROUP BY kind`,
        [reel.id]
      );

      const reactions = {
        like: 0, love: 0, laugh: 0, wow: 0, sad: 0, angry: 0
      };

      reactionsResult.rows.forEach(row => {
        reactions[row.kind as keyof typeof reactions] = parseInt(row.count);
      });

      reel.reactions = reactions;

      const commentsResult = await query(
        'SELECT COUNT(*) as count FROM comments WHERE reel_id = $1',
        [reel.id]
      );
      reel.comments_count = parseInt(commentsResult.rows[0].count);
    }

    return reels;
  }

  async getReelById(reelId: string, userId?: string): Promise<Reel | null> {
    const result = await query(
      `SELECT r.*, u.username, u.display_name, u.avatar_url
       FROM reels r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [reelId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const reel = result.rows[0] as Reel;

    // Get reactions count
    const reactionsResult = await query(
      `SELECT kind, COUNT(*) as count
       FROM reactions
       WHERE reel_id = $1
       GROUP BY kind`,
      [reelId]
    );

    const reactions = {
      like: 0, love: 0, laugh: 0, wow: 0, sad: 0, angry: 0
    };

    reactionsResult.rows.forEach(row => {
      reactions[row.kind as keyof typeof reactions] = parseInt(row.count);
    });

    reel.reactions = reactions;

    // Get comments count
    const commentsResult = await query(
      'SELECT COUNT(*) as count FROM comments WHERE reel_id = $1',
      [reelId]
    );
    reel.comments_count = parseInt(commentsResult.rows[0].count);

    // Get user's reaction if authenticated
    if (userId) {
      const userReactionResult = await query(
        'SELECT kind FROM reactions WHERE reel_id = $1 AND user_id = $2',
        [reelId, userId]
      );
      reel.user_reaction = userReactionResult.rows[0]?.kind;
    }

    return reel;
  }

  async updateReel(reelId: string, userId: string, data: UpdateReelData): Promise<Reel | null> {
    // Check if user owns the reel
    const ownershipResult = await query(
      'SELECT id FROM reels WHERE id = $1 AND user_id = $2',
      [reelId, userId]
    );

    if (ownershipResult.rows.length === 0) {
      return null;
    }

    const result = await query(
      `UPDATE reels 
       SET caption = COALESCE($1, caption),
           updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [data.caption, reelId, userId]
    );

    return result.rows[0] as Reel;
  }

  async deleteReel(reelId: string, userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM reels WHERE id = $1 AND user_id = $2 RETURNING id',
      [reelId, userId]
    );

    if (result.rows.length > 0) {
      logger.info(`Reel ${reelId} deleted by user ${userId}`);
      return true;
    }

    return false;
  }

  async incrementViews(reelId: string, userId?: string, ip?: string): Promise<void> {
    // Increment view count
    await query(
      'UPDATE reels SET views_count = views_count + 1 WHERE id = $1',
      [reelId]
    );

    // Record view for analytics
    await query(
      `INSERT INTO views (user_id, reel_id, ip)
       VALUES ($1, $2, $3)`,
      [userId || null, reelId, ip || null]
    );
  }

  async getUserReels(username: string, page: number = 1, limit: number = 20): Promise<Reel[]> {
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT r.*, u.username, u.display_name, u.avatar_url
       FROM reels r
       JOIN users u ON r.user_id = u.id
       WHERE u.username = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [username, limit, offset]
    );

    return result.rows as Reel[];
  }
}
