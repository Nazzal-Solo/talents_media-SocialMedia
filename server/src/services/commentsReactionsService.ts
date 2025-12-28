import { query } from '../models/db';
import { logger } from '../middlewares';

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id?: string | null;
  text: string;
  created_at: Date;
  user?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  reactions?: Record<string, number>;
  user_reaction?: string;
  replies?: Comment[];
  replies_count?: number;
}

export interface Reaction {
  id: string;
  post_id?: string;
  comment_id?: string;
  user_id: string;
  kind: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';
  created_at: Date;
}

export class CommentsService {
  async createComment(
    postId: string,
    userId: string,
    text: string,
    parentCommentId?: string | null
  ): Promise<Comment> {
    const result = await query(
      `INSERT INTO comments (post_id, user_id, text, parent_comment_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [postId, userId, text, parentCommentId || null]
    );

    const comment = result.rows[0] as Comment;

    // Get user information
    const userResult = await query(
      `SELECT id, username, display_name, avatar_url
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length > 0) {
      const userData = userResult.rows[0];
      comment.user = {
        id: userData.id,
        username: userData.username,
        display_name: userData.display_name,
        avatar_url: userData.avatar_url,
      };
    }

    // Get reactions for the comment
    const reactionsService = new ReactionsService();
    comment.reactions = await reactionsService.getReactions(
      undefined,
      comment.id
    );

    // Get user reaction if userId is provided
    const userReactionResult = await query(
      `SELECT kind FROM reactions 
       WHERE user_id = $1 AND comment_id = $2 AND post_id IS NULL`,
      [userId, comment.id]
    );
    comment.user_reaction = userReactionResult.rows[0]?.kind || undefined;

    logger.info(
      `New comment created by user ${userId} on post ${postId}${parentCommentId ? ` (reply to ${parentCommentId})` : ''}`
    );
    return comment;
  }

  async getPostComments(
    postId: string,
    page: number = 1,
    limit: number = 20,
    userId?: string
  ): Promise<Comment[]> {
    try {
      const offset = (page - 1) * limit;

      // Get top-level comments (no parent_comment_id)
      const result = await query(
        `SELECT c.*, u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.post_id = $1 AND c.parent_comment_id IS NULL
         ORDER BY c.created_at ASC
         LIMIT $2 OFFSET $3`,
        [postId, limit, offset]
      );

      // If no comments, return empty array
      if (result.rows.length === 0) {
        return [];
      }

      const reactionsService = new ReactionsService();
      const commentIds = result.rows.map(row => row.id);

      // Get reactions for all comments
      const reactionsMap = new Map<string, Record<string, number>>();
      const userReactionsMap = new Map<string, string>();

      // Get reaction counts for all comments
      const reactionsResult = await query(
        `SELECT comment_id, kind, COUNT(*) as count
         FROM reactions
         WHERE comment_id = ANY($1::uuid[])
         GROUP BY comment_id, kind`,
        [commentIds]
      );

      // Initialize reactions map
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

      // Populate reactions map
      reactionsResult.rows.forEach(row => {
        const reactions = reactionsMap.get(row.comment_id) || {
          like: 0,
          love: 0,
          laugh: 0,
          wow: 0,
          sad: 0,
          angry: 0,
        };
        reactions[row.kind as keyof typeof reactions] = parseInt(row.count, 10);
        reactionsMap.set(row.comment_id, reactions);
      });

      // Get user reactions if userId provided
      if (userId) {
        const userReactionsResult = await query(
          `SELECT comment_id, kind FROM reactions 
           WHERE user_id = $1 AND comment_id = ANY($2::uuid[]) AND post_id IS NULL`,
          [userId, commentIds]
        );
        userReactionsResult.rows.forEach(row => {
          userReactionsMap.set(row.comment_id, row.kind);
        });
      }

      // Get replies count for each comment
      const repliesCountResult = await query(
        `SELECT parent_comment_id, COUNT(*) as count
         FROM comments
         WHERE parent_comment_id = ANY($1::uuid[])
         GROUP BY parent_comment_id`,
        [commentIds]
      );
      const repliesCountMap = new Map<string, number>();
      repliesCountResult.rows.forEach(row => {
        repliesCountMap.set(row.parent_comment_id, parseInt(row.count, 10));
      });

      // Get replies for each comment
      const repliesResult = await query(
        `SELECT c.*, u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.parent_comment_id = ANY($1::uuid[])
         ORDER BY c.created_at ASC`,
        [commentIds]
      );

      const replyIds = repliesResult.rows.map(row => row.id);

      // Get reactions for replies if there are any
      if (replyIds.length > 0) {
        const replyReactionsResult = await query(
          `SELECT comment_id, kind, COUNT(*) as count
           FROM reactions
           WHERE comment_id = ANY($1::uuid[])
           GROUP BY comment_id, kind`,
          [replyIds]
        );

        // Initialize reactions map for replies
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

        // Populate reactions map for replies
        replyReactionsResult.rows.forEach(row => {
          const reactions = reactionsMap.get(row.comment_id) || {
            like: 0,
            love: 0,
            laugh: 0,
            wow: 0,
            sad: 0,
            angry: 0,
          };
          reactions[row.kind as keyof typeof reactions] = parseInt(
            row.count,
            10
          );
          reactionsMap.set(row.comment_id, reactions);
        });

        // Get user reactions for replies if userId provided
        if (userId) {
          const userReplyReactionsResult = await query(
            `SELECT comment_id, kind FROM reactions 
             WHERE user_id = $1 AND comment_id = ANY($2::uuid[]) AND post_id IS NULL`,
            [userId, replyIds]
          );
          userReplyReactionsResult.rows.forEach(row => {
            userReactionsMap.set(row.comment_id, row.kind);
          });
        }
      }

      const repliesMap = new Map<string, Comment[]>();
      repliesResult.rows.forEach(row => {
        const reply: Comment = {
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
        repliesMap.get(parentId)!.push(reply);
      });

      // Map rows to properly structured Comment objects
      return result.rows.map(row => {
        const commentId = row.id;
        const comment: Comment = {
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
      }) as Comment[];
    } catch (error) {
      logger.error('Error fetching post comments:', error);
      throw error;
    }
  }

  async deleteComment(commentId: string, userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING id',
      [commentId, userId]
    );

    if (result.rows.length > 0) {
      logger.info(`Comment ${commentId} deleted by user ${userId}`);
      return true;
    }

    return false;
  }
}

export class ReactionsService {
  async addReaction(
    userId: string,
    kind: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry',
    postId?: string,
    commentId?: string
  ): Promise<Reaction> {
    if (!postId && !commentId) {
      throw new Error('Either postId or commentId must be provided');
    }

    // Remove ALL existing reactions by this user on this post/comment first
    // This ensures a user can only have ONE reaction per post/comment
    let deleteResult;
    if (postId) {
      // For posts: comment_id should be NULL
      deleteResult = await query(
        `DELETE FROM reactions 
         WHERE user_id = $1 
           AND post_id = $2 
           AND comment_id IS NULL`,
        [userId, postId]
      );
      logger.info(
        `Deleted ${deleteResult?.rowCount || 0} existing reaction(s) for user ${userId} on post ${postId}`
      );
    } else if (commentId) {
      // For comments: post_id should be NULL
      deleteResult = await query(
        `DELETE FROM reactions 
         WHERE user_id = $1 
           AND comment_id = $2 
           AND post_id IS NULL`,
        [userId, commentId]
      );
      logger.info(
        `Deleted ${deleteResult?.rowCount || 0} existing reaction(s) for user ${userId} on comment ${commentId}`
      );
    }

    // Insert the new reaction
    // Use ON CONFLICT to handle any race conditions (upsert)
    const result = await query(
      `INSERT INTO reactions (user_id, kind, post_id, comment_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, post_id, comment_id)
       DO UPDATE SET 
         kind = EXCLUDED.kind,
         created_at = NOW()
       RETURNING *`,
      [userId, kind, postId || null, commentId || null]
    );

    const reaction = result.rows[0] as Reaction;
    logger.info(`Reaction ${kind} added by user ${userId}`);
    return reaction;
  }

  async removeReaction(
    userId: string,
    postId?: string,
    commentId?: string
  ): Promise<boolean> {
    const result = await query(
      'DELETE FROM reactions WHERE user_id = $1 AND post_id = $2 AND comment_id = $3 RETURNING id',
      [userId, postId || null, commentId || null]
    );

    if (result.rows.length > 0) {
      logger.info(`Reaction removed by user ${userId}`);
      return true;
    }

    return false;
  }

  async getReactions(
    postId?: string,
    commentId?: string
  ): Promise<Record<string, number>> {
    const result = await query(
      `SELECT kind, COUNT(*) as count
       FROM reactions
       WHERE post_id = $1 AND comment_id = $2
       GROUP BY kind`,
      [postId || null, commentId || null]
    );

    const reactions = {
      like: 0,
      love: 0,
      laugh: 0,
      wow: 0,
      sad: 0,
      angry: 0,
    };

    result.rows.forEach(row => {
      reactions[row.kind as keyof typeof reactions] = parseInt(row.count);
    });

    return reactions;
  }

  async getReactionUsers(
    postId: string,
    kind?: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry',
    limit: number = 50,
    offset: number = 0
  ): Promise<Array<{
    user_id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    kind: string;
    created_at: Date;
  }>> {
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
    const params: any[] = [postId];

    if (kind) {
      queryText += ` AND r.kind = $2`;
      params.push(kind);
      queryText += ` ORDER BY r.created_at DESC LIMIT $3 OFFSET $4`;
      params.push(limit, offset);
    } else {
      queryText += ` ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`;
      params.push(limit, offset);
    }

    const result = await query(queryText, params);

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
