"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostsService = void 0;
const db_1 = require("../models/db");
const middlewares_1 = require("../middlewares");
const feedRankingService_1 = require("./feedRankingService");
class PostsService {
    constructor() {
        this.rankingService = new feedRankingService_1.FeedRankingService();
    }
    async createPost(userId, data) {
        const result = await (0, db_1.query)(`INSERT INTO posts (user_id, text, media_url, media_type, visibility, feeling, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`, [
            userId,
            data.text,
            data.media_url,
            data.media_type,
            data.visibility,
            data.feeling || null,
            data.location || null,
        ]);
        const post = result.rows[0];
        const userResult = await (0, db_1.query)(`SELECT id, username, display_name, avatar_url
       FROM users
       WHERE id = $1`, [userId]);
        if (userResult.rows.length > 0) {
            const userData = userResult.rows[0];
            post.user = {
                id: userData.id,
                username: userData.username,
                display_name: userData.display_name,
                avatar_url: userData.avatar_url,
            };
        }
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
        middlewares_1.logger.info(`New post created by user ${userId}: ${post.id}`);
        return post;
    }
    async getPostById(postId, userId) {
        const result = await (0, db_1.query)(`SELECT p.*, u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`, [postId]);
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
        };
        const reactionsResult = await (0, db_1.query)(`SELECT kind, COUNT(*) as count
       FROM reactions
       WHERE post_id = $1
       GROUP BY kind`, [postId]);
        const reactions = {
            like: 0,
            love: 0,
            laugh: 0,
            wow: 0,
            sad: 0,
            angry: 0,
        };
        reactionsResult.rows.forEach(row => {
            reactions[row.kind] = parseInt(row.count);
        });
        post.reactions = reactions;
        const commentsResult = await (0, db_1.query)('SELECT COUNT(*) as count FROM comments WHERE post_id = $1', [postId]);
        post.comments_count = parseInt(commentsResult.rows[0].count);
        if (userId) {
            const userReactionResult = await (0, db_1.query)('SELECT kind FROM reactions WHERE post_id = $1 AND user_id = $2', [postId, userId]);
            post.user_reaction = userReactionResult.rows[0]?.kind;
        }
        return post;
    }
    async getFeed(userId, page = 1, limit = 20) {
        const startTime = Date.now();
        middlewares_1.logger.info('[PostsService] getFeed - START', { userId, page, limit });
        try {
            const connectionCheckStart = Date.now();
            const connectionCheck = await (0, db_1.query)(`SELECT 1 FROM follows WHERE follower_id = $1 OR following_id = $1 LIMIT 1`, [userId]);
            const hasConnections = connectionCheck.rows.length > 0;
            const connectionCheckTime = Date.now() - connectionCheckStart;
            middlewares_1.logger.info('[PostsService] getFeed - Step 1: Connection check', {
                hasConnections,
                duration: `${connectionCheckTime}ms`,
            });
            let posts;
            if (!hasConnections) {
                middlewares_1.logger.info('[PostsService] getFeed - Step 2a: Using simple query (no connections)');
                const queryStart = Date.now();
                const offset = (page - 1) * limit;
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
                let result;
                try {
                    result = await (0, db_1.query)(simpleQuery, [limit, offset], 12000);
                }
                catch (queryError) {
                    if (queryError.message?.includes('timeout')) {
                        console.warn('🔴 [PostsService] Query timed out, trying simpler fallback...');
                        try {
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
                            result = await (0, db_1.query)(fallbackQuery, [limit, offset], 8000);
                            console.log('🟢 [PostsService] Fallback query succeeded:', result.rows.length, 'posts');
                        }
                        catch (fallbackError) {
                            console.error('🔴 [PostsService] Both queries failed, returning empty array');
                            result = { rows: [] };
                        }
                    }
                    else {
                        throw queryError;
                    }
                }
                if (result.rows.length === 0 ||
                    (result.rows.length < 5 && page === 1)) {
                    console.log('🔵 [PostsService] Got few/no results with time window, trying without time limit...');
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
                        const retryResult = await (0, db_1.query)(simpleQuery, [limit, offset], 12000);
                        if (retryResult.rows.length > result.rows.length) {
                            result = retryResult;
                            console.log('🟢 [PostsService] Query without time window returned:', result.rows.length, 'posts');
                        }
                    }
                    catch (retryError) {
                        console.warn('🔴 [PostsService] Retry query failed, using original results:', retryError.message);
                    }
                }
                const queryTime = Date.now() - queryStart;
                console.log('🟢 [PostsService] Simple query completed', {
                    rowCount: result.rows.length,
                    duration: `${queryTime}ms`,
                    page,
                    limit,
                });
                middlewares_1.logger.info('[PostsService] getFeed - Step 2a: Simple query completed', {
                    rowCount: result.rows.length,
                    duration: `${queryTime}ms`,
                });
                setImmediate(async () => {
                    try {
                        const countQuery = `SELECT COUNT(*) as total FROM posts WHERE visibility = 'public'`;
                        const countResult = await (0, db_1.query)(countQuery, [], 3000);
                        const totalPosts = parseInt(countResult.rows[0]?.total || '0');
                        console.log('🔵 [PostsService] Total public posts in database:', totalPosts);
                    }
                    catch (countError) {
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
                }));
            }
            else {
                middlewares_1.logger.info('[PostsService] getFeed - Step 2b: Using ranking service (has connections)');
                const rankingStart = Date.now();
                const rankedResult = await this.rankingService.getRankedHomeFeed(userId, {
                    page,
                    limit,
                });
                const rankingTime = Date.now() - rankingStart;
                middlewares_1.logger.info('[PostsService] getFeed - Step 2b: Ranking service completed', {
                    postCount: rankedResult.posts.length,
                    duration: `${rankingTime}ms`,
                });
                posts = rankedResult.posts;
            }
            const queryTime = Date.now() - startTime;
            if (queryTime > 1000) {
                middlewares_1.logger.warn(`[PostsService] getFeed query took ${queryTime}ms (hasConnections: ${hasConnections})`);
            }
            if (posts.length === 0) {
                middlewares_1.logger.info('[PostsService] getFeed - Step 3: No posts found, returning early');
                return posts;
            }
            middlewares_1.logger.info('[PostsService] getFeed - Step 4: Enriching posts', {
                postCount: posts.length,
            });
            const enrichStart = Date.now();
            const postIds = posts.map(p => p.id);
            const reactionsStart = Date.now();
            const reactionsResult = await (0, db_1.query)(`SELECT post_id, kind, COUNT(*) as count
         FROM reactions
         WHERE post_id = ANY($1::uuid[]) AND comment_id IS NULL
         GROUP BY post_id, kind`, [postIds]);
            middlewares_1.logger.info('[PostsService] getFeed - Step 4a: Reactions fetched', {
                duration: `${Date.now() - reactionsStart}ms`,
            });
            const commentsStart = Date.now();
            const commentsResult = await (0, db_1.query)(`SELECT post_id, COUNT(*) as count
         FROM comments
         WHERE post_id = ANY($1::uuid[])
         GROUP BY post_id`, [postIds]);
            middlewares_1.logger.info('[PostsService] getFeed - Step 4b: Comments fetched', {
                duration: `${Date.now() - commentsStart}ms`,
            });
            const userReactionsStart = Date.now();
            const userReactionsResult = userId && userId !== '00000000-0000-0000-0000-000000000000'
                ? await (0, db_1.query)(`SELECT post_id, kind
             FROM reactions
             WHERE post_id = ANY($1::uuid[]) AND user_id = $2 AND comment_id IS NULL`, [postIds, userId])
                : { rows: [] };
            middlewares_1.logger.info('[PostsService] getFeed - Step 4c: User reactions fetched', {
                duration: `${Date.now() - userReactionsStart}ms`,
            });
            const reactionsMap = new Map();
            reactionsResult.rows.forEach(row => {
                if (!reactionsMap.has(row.post_id)) {
                    reactionsMap.set(row.post_id, new Map());
                }
                reactionsMap.get(row.post_id).set(row.kind, parseInt(row.count));
            });
            const commentsMap = new Map();
            commentsResult.rows.forEach(row => {
                commentsMap.set(row.post_id, parseInt(row.count));
            });
            const userReactionsMap = new Map();
            userReactionsResult.rows.forEach(row => {
                userReactionsMap.set(row.post_id, row.kind);
            });
            const mappingStart = Date.now();
            posts.forEach(post => {
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
                            post.reactions[kind] = count;
                        }
                    });
                }
                post.comments_count = commentsMap.get(post.id) || 0;
                post.user_reaction = userReactionsMap.get(post.id);
            });
            middlewares_1.logger.info('[PostsService] getFeed - Step 5: Posts enriched', {
                duration: `${Date.now() - mappingStart}ms`,
                enrichDuration: `${Date.now() - enrichStart}ms`,
                totalDuration: `${Date.now() - startTime}ms`,
            });
            return posts;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            console.error('🔴 [PostsService] getFeed - ERROR:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                code: error.code,
                duration: `${duration}ms`,
                userId,
                page,
                limit,
                error: error,
            });
            middlewares_1.logger.error('[PostsService] getFeed - ERROR:', {
                error: error.message,
                stack: error.stack,
                name: error.name,
                code: error.code,
                duration: `${duration}ms`,
                userId,
                page,
                limit,
            });
            throw error;
        }
    }
    async getExplore(userId, page = 1, limit = 20) {
        const startTime = Date.now();
        console.log('🔵 [PostsService] getExplore - START', {
            userId: userId || 'anonymous',
            page,
            limit,
        });
        try {
            const rankingUserId = userId || '00000000-0000-0000-0000-000000000000';
            console.log('🔵 [PostsService] getExplore - Calling ranking service');
            const rankingStart = Date.now();
            const { posts } = await this.rankingService.getRankedExploreFeed(rankingUserId, {
                page,
                limit,
            });
            const rankingTime = Date.now() - rankingStart;
            console.log('🔵 [PostsService] getExplore - Ranking service returned', {
                postCount: posts.length,
                duration: `${rankingTime}ms`,
            });
            if (posts.length === 0) {
                return posts;
            }
            const postIds = posts.map(p => p.id);
            const reactionsResult = await (0, db_1.query)(`SELECT post_id, kind, COUNT(*) as count
         FROM reactions
         WHERE post_id = ANY($1::uuid[]) AND comment_id IS NULL
         GROUP BY post_id, kind`, [postIds]);
            const commentsResult = await (0, db_1.query)(`SELECT post_id, COUNT(*) as count
         FROM comments
         WHERE post_id = ANY($1::uuid[])
         GROUP BY post_id`, [postIds]);
            const userReactionsResult = userId && userId !== '00000000-0000-0000-0000-000000000000'
                ? await (0, db_1.query)(`SELECT post_id, kind
             FROM reactions
             WHERE post_id = ANY($1::uuid[]) AND user_id = $2 AND comment_id IS NULL`, [postIds, userId])
                : { rows: [] };
            const reactionsMap = new Map();
            reactionsResult.rows.forEach(row => {
                if (!reactionsMap.has(row.post_id)) {
                    reactionsMap.set(row.post_id, new Map());
                }
                reactionsMap.get(row.post_id).set(row.kind, parseInt(row.count));
            });
            const commentsMap = new Map();
            commentsResult.rows.forEach(row => {
                commentsMap.set(row.post_id, parseInt(row.count));
            });
            const userReactionsMap = new Map();
            userReactionsResult.rows.forEach(row => {
                userReactionsMap.set(row.post_id, row.kind);
            });
            posts.forEach(post => {
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
                            post.reactions[kind] = count;
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
        }
        catch (error) {
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
                error: error,
            });
            middlewares_1.logger.error('[PostsService] getExplore - ERROR:', {
                error: error.message,
                stack: error.stack,
                name: error.name,
                code: error.code,
                duration: `${duration}ms`,
                userId: userId || 'anonymous',
                page,
                limit,
            });
            throw error;
        }
    }
    async updatePost(postId, userId, data) {
        const ownershipResult = await (0, db_1.query)('SELECT id FROM posts WHERE id = $1 AND user_id = $2', [postId, userId]);
        if (ownershipResult.rows.length === 0) {
            return null;
        }
        const updates = [];
        const values = [];
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
            return this.getPostById(postId, userId);
        }
        updates.push(`updated_at = NOW()`);
        values.push(postId, userId);
        const result = await (0, db_1.query)(`UPDATE posts 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING *`, values);
        return result.rows[0];
    }
    async deletePost(postId, userId) {
        const result = await (0, db_1.query)('DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id', [postId, userId]);
        if (result.rows.length > 0) {
            middlewares_1.logger.info(`Post ${postId} deleted by user ${userId}`);
            return true;
        }
        return false;
    }
    async getUserPosts(username, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const result = await (0, db_1.query)(`SELECT p.*, u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE u.username = $1 AND p.visibility = 'public'
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`, [username, limit, offset]);
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
        }));
    }
    async getTrendingHashtags(limit = 10) {
        const result = await (0, db_1.query)(`SELECT text
       FROM posts
       WHERE visibility = 'public' AND text IS NOT NULL
       AND text ~ '#[A-Za-z0-9_]+'`);
        const hashtagCounts = {};
        const hashtagRegex = /#(\w+)/g;
        result.rows.forEach(row => {
            const matches = row.text.matchAll(hashtagRegex);
            for (const match of matches) {
                const tag = `#${match[1]}`;
                hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
            }
        });
        const trending = Object.entries(hashtagCounts)
            .map(([tag, posts]) => ({ tag, posts }))
            .sort((a, b) => b.posts - a.posts)
            .slice(0, limit);
        return trending;
    }
    async hidePost(userId, postId) {
        try {
            await (0, db_1.query)(`INSERT INTO hidden_posts (user_id, post_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, post_id) DO NOTHING`, [userId, postId]);
            middlewares_1.logger.info(`Post ${postId} hidden by user ${userId}`);
            return true;
        }
        catch (error) {
            middlewares_1.logger.error('Hide post error:', error);
            return false;
        }
    }
    async reportPost(userId, postId, reason, description) {
        try {
            await (0, db_1.query)(`INSERT INTO reported_posts (user_id, post_id, reason, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, post_id) DO NOTHING`, [userId, postId, reason || null, description || null]);
            middlewares_1.logger.info(`Post ${postId} reported by user ${userId}`);
            return true;
        }
        catch (error) {
            middlewares_1.logger.error('Report post error:', error);
            return false;
        }
    }
    async markNotInterested(userId, postId) {
        try {
            await (0, db_1.query)(`INSERT INTO not_interested_posts (user_id, post_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, post_id) DO NOTHING`, [userId, postId]);
            middlewares_1.logger.info(`Post ${postId} marked as not interested by user ${userId}`);
            return true;
        }
        catch (error) {
            middlewares_1.logger.error('Not interested post error:', error);
            return false;
        }
    }
    async getHiddenPostIds(userId) {
        const result = await (0, db_1.query)('SELECT post_id FROM hidden_posts WHERE user_id = $1', [userId]);
        return result.rows.map(row => row.post_id);
    }
    async getNotInterestedPostIds(userId) {
        const result = await (0, db_1.query)('SELECT post_id FROM not_interested_posts WHERE user_id = $1', [userId]);
        return result.rows.map(row => row.post_id);
    }
    async searchPosts(searchQueryParam, userId, limit = 20, mediaType) {
        try {
            const searchTerm = searchQueryParam
                ? searchQueryParam.toLowerCase().trim()
                : '';
            const offset = 0;
            const hasQuery = searchTerm.length > 0;
            const isHashtagSearch = hasQuery && searchTerm.startsWith('#');
            const hashtagTerm = isHashtagSearch
                ? searchTerm.substring(1)
                : searchTerm;
            middlewares_1.logger.info(`[SearchPosts] Query: "${searchQueryParam}", isHashtag: ${isHashtagSearch}, hashtagTerm: "${hashtagTerm}", limit: ${limit}, mediaType: ${mediaType}`);
            let result;
            if (!hasQuery && mediaType) {
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
                    result = await (0, db_1.query)(queryText, params);
                    const queryTime = Date.now() - startTime;
                    middlewares_1.logger.info(`[SearchPosts] Found ${result.rows.length} rows for mediaType: ${mediaType} in ${queryTime}ms`);
                }
                catch (error) {
                    const queryTime = Date.now() - startTime;
                    middlewares_1.logger.error(`[SearchPosts] Query failed for mediaType: ${mediaType} after ${queryTime}ms`, error);
                    throw error;
                }
            }
            else if (isHashtagSearch && hashtagTerm.length > 0) {
                const hashtagPattern = `%#${hashtagTerm}%`;
                middlewares_1.logger.info(`[SearchPosts] Hashtag pattern: "${hashtagPattern}"`);
                let queryText = `SELECT p.*, u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
           FROM posts p
           JOIN users u ON p.user_id = u.id
           WHERE p.visibility = 'public' 
              AND p.text IS NOT NULL
              AND LOWER(p.text) LIKE $1`;
                let params = [hashtagPattern];
                if (mediaType) {
                    queryText += ` AND p.media_type = $${params.length + 1}`;
                    params.push(mediaType);
                }
                queryText += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
                params.push(limit, offset);
                result = await (0, db_1.query)(queryText, params);
                middlewares_1.logger.info(`[SearchPosts] Found ${result.rows.length} rows for hashtag search`);
            }
            else if (hasQuery) {
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
                let params = [searchPattern];
                if (mediaType) {
                    queryText += ` AND p.media_type = $${params.length + 1}`;
                    params.push(mediaType);
                }
                queryText += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
                params.push(limit, offset);
                result = await (0, db_1.query)(queryText, params);
                middlewares_1.logger.info(`[SearchPosts] Found ${result.rows.length} rows for regular search`);
            }
            else {
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
            }));
            if (posts.length === 0) {
                return posts;
            }
            const postIds = posts.map(p => p.id);
            let reactionsResult = { rows: [] };
            let commentsResult = { rows: [] };
            let userReactionsResult = { rows: [] };
            try {
                const bulkStartTime = Date.now();
                reactionsResult = await (0, db_1.query)(`SELECT post_id, kind, COUNT(*) as count
           FROM reactions
           WHERE post_id = ANY($1::uuid[]) AND comment_id IS NULL
           GROUP BY post_id, kind`, [postIds]);
                commentsResult = await (0, db_1.query)(`SELECT post_id, COUNT(*) as count
           FROM comments
           WHERE post_id = ANY($1::uuid[])
           GROUP BY post_id`, [postIds]);
                userReactionsResult = userId
                    ? await (0, db_1.query)(`SELECT post_id, kind
               FROM reactions
               WHERE post_id = ANY($1::uuid[]) AND user_id = $2 AND comment_id IS NULL`, [postIds, userId])
                    : { rows: [] };
                const bulkTime = Date.now() - bulkStartTime;
                if (bulkTime > 2000) {
                    middlewares_1.logger.warn(`[SearchPosts] Bulk queries took ${bulkTime}ms for ${postIds.length} posts`);
                }
            }
            catch (bulkError) {
                middlewares_1.logger.error('[SearchPosts] Bulk queries failed, continuing with empty reactions/comments', {
                    error: bulkError.message,
                    mediaType,
                });
            }
            const reactionsMap = new Map();
            reactionsResult.rows.forEach(row => {
                if (!reactionsMap.has(row.post_id)) {
                    reactionsMap.set(row.post_id, new Map());
                }
                reactionsMap.get(row.post_id).set(row.kind, parseInt(row.count));
            });
            const commentsMap = new Map();
            commentsResult.rows.forEach(row => {
                commentsMap.set(row.post_id, parseInt(row.count));
            });
            const userReactionsMap = new Map();
            userReactionsResult.rows.forEach(row => {
                userReactionsMap.set(row.post_id, row.kind);
            });
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
                            post.reactions[kind] = count;
                        }
                    });
                }
                else {
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
            if (userId && searchQueryParam && searchQueryParam.trim().length > 0) {
                const rankedPosts = await this.rankingService.rankSearchResults(posts, userId, searchQueryParam);
                return rankedPosts;
            }
            return posts;
        }
        catch (error) {
            middlewares_1.logger.error('[SearchPosts] Error searching posts:', {
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
exports.PostsService = PostsService;
//# sourceMappingURL=postsService.js.map