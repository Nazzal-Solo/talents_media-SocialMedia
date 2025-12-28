import { query } from '../models/db';
import { logger } from '../middlewares';
import { FeedRankingService } from './feedRankingService';

export interface Post {
  id: string;
  user_id: string;
  text?: string;
  media_url?: string;
  media_type: 'image' | 'video' | 'none';
  visibility: 'public' | 'followers' | 'private';
  feeling?: string;
  location?: string;
  created_at: Date;
  updated_at: Date;
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

export interface CreatePostData {
  text?: string;
  media_url?: string;
  media_type: 'image' | 'video' | 'none';
  visibility: 'public' | 'followers' | 'private';
  feeling?: string;
  location?: string;
}

export interface UpdatePostData {
  text?: string;
  media_url?: string;
  media_type?: 'image' | 'video' | 'none';
  visibility?: 'public' | 'followers' | 'private';
  feeling?: string;
  location?: string;
}

export class PostsService {
  private rankingService = new FeedRankingService();

  async createPost(userId: string, data: CreatePostData): Promise<Post> {
    const result = await query(
      `INSERT INTO posts (user_id, text, media_url, media_type, visibility, feeling, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        userId,
        data.text,
        data.media_url,
        data.media_type,
        data.visibility,
        data.feeling || null,
        data.location || null,
      ]
    );

    const post = result.rows[0] as Post;

    // Get user information
    const userResult = await query(
      `SELECT id, username, display_name, avatar_url
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length > 0) {
      const userData = userResult.rows[0];
      post.user = {
        id: userData.id,
        username: userData.username,
        display_name: userData.display_name,
        avatar_url: userData.avatar_url,
      };
    }

    // Initialize reactions and comments_count
    post.reactions = {
      like: 0,
      love: 0,
      laugh: 0,
      wow: 0,
      sad: 0,
      angry: 0,
    };
    post.comments_count = 0;
    post.user_reaction = undefined;

    logger.info(`New post created by user ${userId}: ${post.id}`);
    return post;
  }

  async getPostById(postId: string, userId?: string): Promise<Post | null> {
    const result = await query(
      `SELECT p.*, u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [postId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const post = {
      id: row.id,
      user_id: row.user_id,
      text: row.text,
      media_url: row.media_url,
      media_type: row.media_type,
      visibility: row.visibility,
      feeling: row.feeling,
      location: row.location,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        id: row.user_id_for_join,
        username: row.username,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
      },
    } as Post;

    // Get reactions count
    const reactionsResult = await query(
      `SELECT kind, COUNT(*) as count
       FROM reactions
       WHERE post_id = $1
       GROUP BY kind`,
      [postId]
    );

    const reactions = {
      like: 0,
      love: 0,
      laugh: 0,
      wow: 0,
      sad: 0,
      angry: 0,
    };

    reactionsResult.rows.forEach(row => {
      reactions[row.kind as keyof typeof reactions] = parseInt(row.count);
    });

    post.reactions = reactions;

    // Get comments count
    const commentsResult = await query(
      'SELECT COUNT(*) as count FROM comments WHERE post_id = $1',
      [postId]
    );
    post.comments_count = parseInt(commentsResult.rows[0].count);

    // Get user's reaction if authenticated
    if (userId) {
      const userReactionResult = await query(
        'SELECT kind FROM reactions WHERE post_id = $1 AND user_id = $2',
        [postId, userId]
      );
      post.user_reaction = userReactionResult.rows[0]?.kind;
    }

    return post;
  }

  async getFeed(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<Post[]> {
    const startTime = Date.now();
    logger.info('[PostsService] getFeed - START', { userId, page, limit });

    try {
      // Step 1: Check if user has connections
      const connectionCheckStart = Date.now();
      const connectionCheck = await query(
        `SELECT 1 FROM follows WHERE follower_id = $1 OR following_id = $1 LIMIT 1`,
        [userId]
      );
      const hasConnections = connectionCheck.rows.length > 0;
      const connectionCheckTime = Date.now() - connectionCheckStart;
      logger.info('[PostsService] getFeed - Step 1: Connection check', {
        hasConnections,
        duration: `${connectionCheckTime}ms`,
      });

      let posts: Post[];

      if (!hasConnections) {
        // Step 2a: Simple query for users without connections
        // Aggressively optimized: Very short time window and efficient query
        logger.info(
          '[PostsService] getFeed - Step 2a: Using simple query (no connections)'
        );
        const queryStart = Date.now();
        const offset = (page - 1) * limit;

        // Start without time window to ensure all posts are visible
        // Time window can be added back if performance becomes an issue
        let simpleQuery = `
          SELECT p.id, p.user_id, p.text, p.media_url, p.media_type, p.visibility, p.feeling, p.location, p.created_at, p.updated_at,
                 u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
          FROM (
            SELECT id, user_id, text, media_url, media_type, visibility, feeling, location, created_at, updated_at
            FROM posts
            WHERE visibility = 'public'
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
          ) p
          INNER JOIN users u ON p.user_id = u.id
          ORDER BY p.created_at DESC
        `;

        // Use a reasonable timeout (12 seconds) for this query
        // Wrap in try-catch to handle timeouts gracefully
        let result;
        try {
          result = await query(simpleQuery, [limit, offset], 12000);
        } catch (queryError: any) {
          // If query times out, try a simpler fallback
          if (queryError.message?.includes('timeout')) {
            console.warn(
              '🔴 [PostsService] Query timed out, trying simpler fallback...'
            );
            try {
              // Very simple query - just get recent posts without time window
              const fallbackQuery = `
                SELECT p.id, p.user_id, p.text, p.media_url, p.media_type, p.visibility, p.feeling, p.location, p.created_at, p.updated_at,
                       u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
                FROM (
                  SELECT id, user_id, text, media_url, media_type, visibility, feeling, location, created_at, updated_at
                  FROM posts
                  WHERE visibility = 'public'
                  ORDER BY created_at DESC
                  LIMIT $1 OFFSET $2
                ) p
                INNER JOIN users u ON p.user_id = u.id
                ORDER BY p.created_at DESC
              `;
              result = await query(fallbackQuery, [limit, offset], 8000);
              console.log(
                '🟢 [PostsService] Fallback query succeeded:',
                result.rows.length,
                'posts'
              );
            } catch (fallbackError: any) {
              // If fallback also fails, return empty array
              console.error(
                '🔴 [PostsService] Both queries failed, returning empty array'
              );
              result = { rows: [] };
            }
          } else {
            // Re-throw non-timeout errors
            throw queryError;
          }
        }

        // If we got no results or very few results on page 1, try without time window
        if (
          result.rows.length === 0 ||
          (result.rows.length < 5 && page === 1)
        ) {
          console.log(
            '🔵 [PostsService] Got few/no results with time window, trying without time limit...'
          );
          try {
            simpleQuery = `
              SELECT p.id, p.user_id, p.text, p.media_url, p.media_type, p.visibility, p.feeling, p.location, p.created_at, p.updated_at,
                     u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
              FROM (
                SELECT id, user_id, text, media_url, media_type, visibility, feeling, location, created_at, updated_at
                FROM posts
                WHERE visibility = 'public'
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2
              ) p
              INNER JOIN users u ON p.user_id = u.id
              ORDER BY p.created_at DESC
            `;
            const retryResult = await query(
              simpleQuery,
              [limit, offset],
              12000
            );
            if (retryResult.rows.length > result.rows.length) {
              result = retryResult;
              console.log(
                '🟢 [PostsService] Query without time window returned:',
                result.rows.length,
                'posts'
              );
            }
          } catch (retryError: any) {
            console.warn(
              '🔴 [PostsService] Retry query failed, using original results:',
              retryError.message
            );
            // Use original results if retry fails
          }
        }

        const queryTime = Date.now() - queryStart;
        console.log('🟢 [PostsService] Simple query completed', {
          rowCount: result.rows.length,
          duration: `${queryTime}ms`,
          page,
          limit,
        });
        logger.info(
          '[PostsService] getFeed - Step 2a: Simple query completed',
          {
            rowCount: result.rows.length,
            duration: `${queryTime}ms`,
          }
        );

        // Check total posts for logging (non-blocking, fire and forget)
        // This runs asynchronously and won't block the response
        setImmediate(async () => {
          try {
            const countQuery = `SELECT COUNT(*) as total FROM posts WHERE visibility = 'public'`;
            const countResult = await query(countQuery, [], 3000);
            const totalPosts = parseInt(countResult.rows[0]?.total || '0');
            console.log(
              '🔵 [PostsService] Total public posts in database:',
              totalPosts
            );
          } catch (countError: any) {
            // Silently ignore - not critical for the response
          }
        });

        posts = result.rows.map(row => ({
          id: row.id,
          user_id: row.user_id,
          text: row.text,
          media_url: row.media_url,
          media_type: row.media_type,
          visibility: row.visibility,
          feeling: row.feeling,
          location: row.location,
          created_at: row.created_at,
          updated_at: row.updated_at,
          user: {
            id: row.user_id_for_join,
            username: row.username,
            display_name: row.display_name,
            avatar_url: row.avatar_url,
          },
        })) as Post[];
      } else {
        // Step 2b: Use ranking service for users with connections
        logger.info(
          '[PostsService] getFeed - Step 2b: Using ranking service (has connections)'
        );
        const rankingStart = Date.now();
        const rankedResult = await this.rankingService.getRankedHomeFeed(
          userId,
          {
            page,
            limit,
          }
        );
        const rankingTime = Date.now() - rankingStart;
        logger.info(
          '[PostsService] getFeed - Step 2b: Ranking service completed',
          {
            postCount: rankedResult.posts.length,
            duration: `${rankingTime}ms`,
          }
        );
        posts = rankedResult.posts;
      }

      const queryTime = Date.now() - startTime;
      if (queryTime > 1000) {
        logger.warn(
          `[PostsService] getFeed query took ${queryTime}ms (hasConnections: ${hasConnections})`
        );
      }

      // Step 3: Early return if no posts
      if (posts.length === 0) {
        logger.info(
          '[PostsService] getFeed - Step 3: No posts found, returning early'
        );
        return posts;
      }

      // Step 4: Enrich posts with reactions, comments, and user reactions
      // Use bulk queries to avoid N+1 problem
      logger.info('[PostsService] getFeed - Step 4: Enriching posts', {
        postCount: posts.length,
      });
      const enrichStart = Date.now();
      const postIds = posts.map(p => p.id);

      // Bulk fetch all reactions grouped by post_id and kind
      const reactionsStart = Date.now();
      const reactionsResult = await query(
        `SELECT post_id, kind, COUNT(*) as count
         FROM reactions
         WHERE post_id = ANY($1::uuid[]) AND comment_id IS NULL
         GROUP BY post_id, kind`,
        [postIds]
      );
      logger.info('[PostsService] getFeed - Step 4a: Reactions fetched', {
        duration: `${Date.now() - reactionsStart}ms`,
      });

      // Bulk fetch comment counts for all posts
      const commentsStart = Date.now();
      const commentsResult = await query(
        `SELECT post_id, COUNT(*) as count
         FROM comments
         WHERE post_id = ANY($1::uuid[])
         GROUP BY post_id`,
        [postIds]
      );
      logger.info('[PostsService] getFeed - Step 4b: Comments fetched', {
        duration: `${Date.now() - commentsStart}ms`,
      });

      // Bulk fetch user reactions for all posts (only if user is authenticated)
      const userReactionsStart = Date.now();
      const userReactionsResult =
        userId && userId !== '00000000-0000-0000-0000-000000000000'
          ? await query(
              `SELECT post_id, kind
             FROM reactions
             WHERE post_id = ANY($1::uuid[]) AND user_id = $2 AND comment_id IS NULL`,
              [postIds, userId]
            )
          : { rows: [] };
      logger.info('[PostsService] getFeed - Step 4c: User reactions fetched', {
        duration: `${Date.now() - userReactionsStart}ms`,
      });

      // Create lookup maps for O(1) access
      const reactionsMap = new Map<string, Map<string, number>>();
      reactionsResult.rows.forEach(row => {
        if (!reactionsMap.has(row.post_id)) {
          reactionsMap.set(row.post_id, new Map());
        }
        reactionsMap.get(row.post_id)!.set(row.kind, parseInt(row.count));
      });

      const commentsMap = new Map<string, number>();
      commentsResult.rows.forEach(row => {
        commentsMap.set(row.post_id, parseInt(row.count));
      });

      const userReactionsMap = new Map<string, string>();
      userReactionsResult.rows.forEach(row => {
        userReactionsMap.set(row.post_id, row.kind);
      });

      // Step 5: Map reactions, comments, and user reactions to posts
      const mappingStart = Date.now();
      posts.forEach(post => {
        // Initialize reactions object if not present
        if (!post.reactions) {
          post.reactions = {
            like: 0,
            love: 0,
            laugh: 0,
            wow: 0,
            sad: 0,
            angry: 0,
          };
        }

        const postReactions = reactionsMap.get(post.id);
        if (postReactions) {
          postReactions.forEach((count, kind) => {
            if (post.reactions && kind in post.reactions) {
              post.reactions[kind as keyof typeof post.reactions] = count;
            }
          });
        }

        post.comments_count = commentsMap.get(post.id) || 0;
        post.user_reaction = userReactionsMap.get(post.id);
      });
      logger.info('[PostsService] getFeed - Step 5: Posts enriched', {
        duration: `${Date.now() - mappingStart}ms`,
        enrichDuration: `${Date.now() - enrichStart}ms`,
        totalDuration: `${Date.now() - startTime}ms`,
      });

      return posts;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      // Log full error details for debugging
      console.error('🔴 [PostsService] getFeed - ERROR:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        duration: `${duration}ms`,
        userId,
        page,
        limit,
        error: error, // Full error object
      });
      logger.error('[PostsService] getFeed - ERROR:', {
        error: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        duration: `${duration}ms`,
        userId,
        page,
        limit,
      });
      throw error; // Re-throw to be handled by controller
    }
  }

  async getExplore(
    userId: string | undefined,
    page: number = 1,
    limit: number = 20
  ): Promise<Post[]> {
    const startTime = Date.now();
    console.log('🔵 [PostsService] getExplore - START', {
      userId: userId || 'anonymous',
      page,
      limit,
    });

    try {
      // Use ranking service to get ranked explore feed
      // If no userId, use a temporary ID for ranking (ranking service needs an ID)
      const rankingUserId = userId || '00000000-0000-0000-0000-000000000000';
      console.log('🔵 [PostsService] getExplore - Calling ranking service');
      const rankingStart = Date.now();
      const { posts } = await this.rankingService.getRankedExploreFeed(
        rankingUserId,
        {
          page,
          limit,
        }
      );
      const rankingTime = Date.now() - rankingStart;
      console.log('🔵 [PostsService] getExplore - Ranking service returned', {
        postCount: posts.length,
        duration: `${rankingTime}ms`,
      });

      // Early return if no posts
      if (posts.length === 0) {
        return posts;
      }

      // Enrich posts with reactions, comments, and user reactions
      const postIds = posts.map(p => p.id);

      // Bulk fetch all reactions grouped by post_id and kind
      const reactionsResult = await query(
        `SELECT post_id, kind, COUNT(*) as count
         FROM reactions
         WHERE post_id = ANY($1::uuid[]) AND comment_id IS NULL
         GROUP BY post_id, kind`,
        [postIds]
      );

      // Bulk fetch comment counts for all posts
      const commentsResult = await query(
        `SELECT post_id, COUNT(*) as count
         FROM comments
         WHERE post_id = ANY($1::uuid[])
         GROUP BY post_id`,
        [postIds]
      );

      // Bulk fetch user reactions for all posts (only if user is authenticated)
      const userReactionsResult =
        userId && userId !== '00000000-0000-0000-0000-000000000000'
          ? await query(
              `SELECT post_id, kind
             FROM reactions
             WHERE post_id = ANY($1::uuid[]) AND user_id = $2 AND comment_id IS NULL`,
              [postIds, userId]
            )
          : { rows: [] };

      // Create lookup maps for O(1) access
      const reactionsMap = new Map<string, Map<string, number>>();
      reactionsResult.rows.forEach(row => {
        if (!reactionsMap.has(row.post_id)) {
          reactionsMap.set(row.post_id, new Map());
        }
        reactionsMap.get(row.post_id)!.set(row.kind, parseInt(row.count));
      });

      const commentsMap = new Map<string, number>();
      commentsResult.rows.forEach(row => {
        commentsMap.set(row.post_id, parseInt(row.count));
      });

      const userReactionsMap = new Map<string, string>();
      userReactionsResult.rows.forEach(row => {
        userReactionsMap.set(row.post_id, row.kind);
      });

      // Map reactions, comments, and user reactions to posts
      posts.forEach(post => {
        // Initialize reactions object if not present
        if (!post.reactions) {
          post.reactions = {
            like: 0,
            love: 0,
            laugh: 0,
            wow: 0,
            sad: 0,
            angry: 0,
          };
        }

        const postReactions = reactionsMap.get(post.id);
        if (postReactions) {
          postReactions.forEach((count, kind) => {
            if (post.reactions && kind in post.reactions) {
              post.reactions[kind as keyof typeof post.reactions] = count;
            }
          });
        }

        post.comments_count = commentsMap.get(post.id) || 0;
        post.user_reaction = userReactionsMap.get(post.id);
      });

      const totalDuration = Date.now() - startTime;
      console.log('🟢 [PostsService] getExplore - COMPLETE', {
        postCount: posts.length,
        duration: `${totalDuration}ms`,
      });
      return posts;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('🔴 [PostsService] getExplore - ERROR:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        duration: `${duration}ms`,
        userId: userId || 'anonymous',
        page,
        limit,
        error: error, // Full error object
      });
      logger.error('[PostsService] getExplore - ERROR:', {
        error: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        duration: `${duration}ms`,
        userId: userId || 'anonymous',
        page,
        limit,
      });
      throw error; // Re-throw to be handled by controller
    }
  }

  async updatePost(
    postId: string,
    userId: string,
    data: UpdatePostData
  ): Promise<Post | null> {
    // Check if user owns the post
    const ownershipResult = await query(
      'SELECT id FROM posts WHERE id = $1 AND user_id = $2',
      [postId, userId]
    );

    if (ownershipResult.rows.length === 0) {
      return null;
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.text !== undefined) {
      updates.push(`text = $${paramIndex++}`);
      values.push(data.text || null);
    }
    if (data.media_url !== undefined) {
      updates.push(`media_url = $${paramIndex++}`);
      values.push(data.media_url || null);
    }
    if (data.media_type !== undefined) {
      updates.push(`media_type = $${paramIndex++}`);
      values.push(data.media_type || 'none');
    }
    if (data.visibility !== undefined) {
      updates.push(`visibility = $${paramIndex++}`);
      values.push(data.visibility);
    }
    if (data.feeling !== undefined) {
      updates.push(`feeling = $${paramIndex++}`);
      values.push(data.feeling || null);
    }
    if (data.location !== undefined) {
      updates.push(`location = $${paramIndex++}`);
      values.push(data.location || null);
    }

    if (updates.length === 0) {
      // No updates to make, just return the current post
      return this.getPostById(postId, userId);
    }

    updates.push(`updated_at = NOW()`);
    values.push(postId, userId);

    const result = await query(
      `UPDATE posts 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    return result.rows[0] as Post;
  }

  async deletePost(postId: string, userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id',
      [postId, userId]
    );

    if (result.rows.length > 0) {
      logger.info(`Post ${postId} deleted by user ${userId}`);
      return true;
    }

    return false;
  }

  async getUserPosts(
    username: string,
    page: number = 1,
    limit: number = 20
  ): Promise<Post[]> {
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT p.*, u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE u.username = $1 AND p.visibility = 'public'
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [username, limit, offset]
    );

    // Map rows to properly structured Post objects
    return result.rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      text: row.text,
      media_url: row.media_url,
      media_type: row.media_type,
      visibility: row.visibility,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        id: row.user_id_for_join,
        username: row.username,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
      },
    })) as Post[];
  }

  async getTrendingHashtags(
    limit: number = 10
  ): Promise<Array<{ tag: string; posts: number }>> {
    // Extract hashtags from posts text using regex
    // Find all hashtags in posts text field
    const result = await query(
      `SELECT text
       FROM posts
       WHERE visibility = 'public' AND text IS NOT NULL
       AND text ~ '#[A-Za-z0-9_]+'`
    );

    const hashtagCounts: Record<string, number> = {};
    const hashtagRegex = /#(\w+)/g;

    result.rows.forEach(row => {
      const matches = row.text.matchAll(hashtagRegex);
      for (const match of matches) {
        const tag = `#${match[1]}`;
        hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
      }
    });

    // Convert to array, sort by count descending, and limit
    const trending = Object.entries(hashtagCounts)
      .map(([tag, posts]) => ({ tag, posts }))
      .sort((a, b) => b.posts - a.posts)
      .slice(0, limit);

    return trending;
  }

  async hidePost(userId: string, postId: string): Promise<boolean> {
    try {
      await query(
        `INSERT INTO hidden_posts (user_id, post_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, post_id) DO NOTHING`,
        [userId, postId]
      );
      logger.info(`Post ${postId} hidden by user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Hide post error:', error);
      return false;
    }
  }

  async reportPost(
    userId: string,
    postId: string,
    reason?: string,
    description?: string
  ): Promise<boolean> {
    try {
      await query(
        `INSERT INTO reported_posts (user_id, post_id, reason, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, post_id) DO NOTHING`,
        [userId, postId, reason || null, description || null]
      );
      logger.info(`Post ${postId} reported by user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Report post error:', error);
      return false;
    }
  }

  async markNotInterested(userId: string, postId: string): Promise<boolean> {
    try {
      await query(
        `INSERT INTO not_interested_posts (user_id, post_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, post_id) DO NOTHING`,
        [userId, postId]
      );
      logger.info(`Post ${postId} marked as not interested by user ${userId}`);
      return true;
    } catch (error) {
      logger.error('Not interested post error:', error);
      return false;
    }
  }

  async getHiddenPostIds(userId: string): Promise<string[]> {
    const result = await query(
      'SELECT post_id FROM hidden_posts WHERE user_id = $1',
      [userId]
    );
    return result.rows.map(row => row.post_id);
  }

  async getNotInterestedPostIds(userId: string): Promise<string[]> {
    const result = await query(
      'SELECT post_id FROM not_interested_posts WHERE user_id = $1',
      [userId]
    );
    return result.rows.map(row => row.post_id);
  }

  async searchPosts(
    searchQueryParam: string,
    userId?: string,
    limit: number = 20,
    mediaType?: 'image' | 'video'
  ): Promise<Post[]> {
    try {
      const searchTerm = searchQueryParam
        ? searchQueryParam.toLowerCase().trim()
        : '';
      const offset = 0;
      const hasQuery = searchTerm.length > 0;

      // Check if search term starts with # (hashtag search)
      const isHashtagSearch = hasQuery && searchTerm.startsWith('#');
      const hashtagTerm = isHashtagSearch
        ? searchTerm.substring(1)
        : searchTerm;

      logger.info(
        `[SearchPosts] Query: "${searchQueryParam}", isHashtag: ${isHashtagSearch}, hashtagTerm: "${hashtagTerm}", limit: ${limit}, mediaType: ${mediaType}`
      );

      let result;

      // If no query but mediaType is specified, return all posts with that media type
      if (!hasQuery && mediaType) {
        // Optimized query using the index we created
        // Use a more efficient query structure that leverages the index
        const queryText = `SELECT p.*, u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
           FROM posts p
           INNER JOIN users u ON p.user_id = u.id
           WHERE p.media_type = $1
              AND p.visibility = 'public'
           ORDER BY p.created_at DESC 
           LIMIT $2 OFFSET $3`;
        const params = [mediaType, limit, offset];

        const startTime = Date.now();
        try {
          result = await query(queryText, params);
          const queryTime = Date.now() - startTime;
          logger.info(
            `[SearchPosts] Found ${result.rows.length} rows for mediaType: ${mediaType} in ${queryTime}ms`
          );
        } catch (error: any) {
          const queryTime = Date.now() - startTime;
          logger.error(
            `[SearchPosts] Query failed for mediaType: ${mediaType} after ${queryTime}ms`,
            error
          );
          throw error;
        }
      } else if (isHashtagSearch && hashtagTerm.length > 0) {
        // For hashtag search, look specifically for the hashtag in the text
        // Match: #hashtag anywhere in the text (handle NULL text fields)
        const hashtagPattern = `%#${hashtagTerm}%`;
        logger.info(`[SearchPosts] Hashtag pattern: "${hashtagPattern}"`);

        let queryText = `SELECT p.*, u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
           FROM posts p
           JOIN users u ON p.user_id = u.id
           WHERE p.visibility = 'public' 
              AND p.text IS NOT NULL
              AND LOWER(p.text) LIKE $1`;
        let params: any[] = [hashtagPattern];

        if (mediaType) {
          queryText += ` AND p.media_type = $${params.length + 1}`;
          params.push(mediaType);
        }

        queryText += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        result = await query(queryText, params);
        logger.info(
          `[SearchPosts] Found ${result.rows.length} rows for hashtag search`
        );
      } else if (hasQuery) {
        // For regular search, search in text, username, and display name
        // Handle NULL text fields properly
        const searchPattern = `%${searchTerm}%`;

        let queryText = `SELECT p.*, u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
           FROM posts p
           JOIN users u ON p.user_id = u.id
           WHERE p.visibility = 'public' 
              AND (
                (p.text IS NOT NULL AND LOWER(p.text) LIKE $1)
                OR LOWER(u.username) LIKE $1 
                OR LOWER(u.display_name) LIKE $1
              )`;
        let params: any[] = [searchPattern];

        if (mediaType) {
          queryText += ` AND p.media_type = $${params.length + 1}`;
          params.push(mediaType);
        }

        queryText += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        result = await query(queryText, params);
        logger.info(
          `[SearchPosts] Found ${result.rows.length} rows for regular search`
        );
      } else {
        // No query and no mediaType - return empty result
        result = { rows: [] };
      }

      const posts = result.rows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        text: row.text,
        media_url: row.media_url,
        media_type: row.media_type,
        visibility: row.visibility,
        feeling: row.feeling,
        location: row.location,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user: {
          id: row.user_id_for_join,
          username: row.username,
          display_name: row.display_name,
          avatar_url: row.avatar_url,
        },
      })) as Post[];

      // Early return if no posts
      if (posts.length === 0) {
        return posts;
      }

      // Extract post IDs for bulk queries
      const postIds = posts.map(p => p.id);

      // For media type searches, wrap bulk queries in timeout protection
      // These queries should be fast, but we'll catch errors gracefully
      let reactionsResult: {
        rows: Array<{ post_id: string; kind: string; count: string }>;
      } = { rows: [] };
      let commentsResult: { rows: Array<{ post_id: string; count: string }> } =
        { rows: [] };
      let userReactionsResult: {
        rows: Array<{ post_id: string; kind: string }>;
      } = { rows: [] };

      try {
        const bulkStartTime = Date.now();

        // Bulk fetch all reactions grouped by post_id and kind
        reactionsResult = await query(
          `SELECT post_id, kind, COUNT(*) as count
           FROM reactions
           WHERE post_id = ANY($1::uuid[]) AND comment_id IS NULL
           GROUP BY post_id, kind`,
          [postIds]
        );

        // Bulk fetch comment counts for all posts
        commentsResult = await query(
          `SELECT post_id, COUNT(*) as count
           FROM comments
           WHERE post_id = ANY($1::uuid[])
           GROUP BY post_id`,
          [postIds]
        );

        // Bulk fetch user reactions for all posts
        userReactionsResult = userId
          ? await query(
              `SELECT post_id, kind
               FROM reactions
               WHERE post_id = ANY($1::uuid[]) AND user_id = $2 AND comment_id IS NULL`,
              [postIds, userId]
            )
          : { rows: [] };

        const bulkTime = Date.now() - bulkStartTime;
        if (bulkTime > 2000) {
          logger.warn(
            `[SearchPosts] Bulk queries took ${bulkTime}ms for ${postIds.length} posts`
          );
        }
      } catch (bulkError: any) {
        // If bulk queries fail, log but continue with empty results
        // This allows the main query results to still be returned
        logger.error(
          '[SearchPosts] Bulk queries failed, continuing with empty reactions/comments',
          {
            error: bulkError.message,
            mediaType,
          }
        );
      }

      // Create lookup maps for O(1) access
      const reactionsMap = new Map<string, Map<string, number>>();
      reactionsResult.rows.forEach(row => {
        if (!reactionsMap.has(row.post_id)) {
          reactionsMap.set(row.post_id, new Map());
        }
        reactionsMap.get(row.post_id)!.set(row.kind, parseInt(row.count));
      });

      const commentsMap = new Map<string, number>();
      commentsResult.rows.forEach(row => {
        commentsMap.set(row.post_id, parseInt(row.count));
      });

      const userReactionsMap = new Map<string, string>();
      userReactionsResult.rows.forEach(row => {
        userReactionsMap.set(row.post_id, row.kind);
      });

      // Map reactions, comments, and user reactions to posts
      posts.forEach(post => {
        const postReactions = reactionsMap.get(post.id);
        if (postReactions) {
          post.reactions = {
            like: 0,
            love: 0,
            laugh: 0,
            wow: 0,
            sad: 0,
            angry: 0,
          };
          postReactions.forEach((count, kind) => {
            if (post.reactions && kind in post.reactions) {
              post.reactions[kind as keyof typeof post.reactions] = count;
            }
          });
        } else {
          post.reactions = {
            like: 0,
            love: 0,
            laugh: 0,
            wow: 0,
            sad: 0,
            angry: 0,
          };
        }

        post.comments_count = commentsMap.get(post.id) || 0;
        post.user_reaction = userReactionsMap.get(post.id);
      });

      // Apply ranking to search results if user is authenticated
      if (userId && searchQueryParam && searchQueryParam.trim().length > 0) {
        const rankedPosts = await this.rankingService.rankSearchResults(
          posts,
          userId,
          searchQueryParam
        );
        return rankedPosts;
      }

      return posts;
    } catch (error: any) {
      logger.error('[SearchPosts] Error searching posts:', {
        error: error.message,
        stack: error.stack,
        searchQueryParam,
        limit,
        mediaType,
      });
      throw error;
    }
  }
}
