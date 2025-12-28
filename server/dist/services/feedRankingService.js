"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedRankingService = void 0;
const db_1 = require("../models/db");
const middlewares_1 = require("../middlewares");
const ranking_1 = require("../config/ranking");
class FeedRankingService {
    extractHashtags(text) {
        if (!text)
            return [];
        const hashtagRegex = /#(\w+)/g;
        const matches = Array.from(text.matchAll(hashtagRegex));
        return matches.map(m => `#${m[1].toLowerCase()}`);
    }
    async computeRelationshipScore(viewerId, authorId) {
        if (viewerId === authorId) {
            return 1.0;
        }
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - ranking_1.RANKING_CONFIG.RELATIONSHIP_WINDOW_DAYS);
        const followResult = await (0, db_1.query)(`SELECT 
        EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2) as is_following,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = $1) as is_followed_by`, [viewerId, authorId]);
        const isFollowing = followResult.rows[0]?.is_following || false;
        const isMutualFollow = isFollowing && (followResult.rows[0]?.is_followed_by || false);
        const reactionsResult = await (0, db_1.query)(`SELECT COUNT(*) as count
       FROM reactions r
       JOIN posts p ON r.post_id = p.id
       WHERE r.user_id = $1 AND p.user_id = $2 AND r.created_at >= $3 AND r.comment_id IS NULL`, [viewerId, authorId, windowStart]);
        const reactionsCount = parseInt(reactionsResult.rows[0]?.count || '0');
        const commentsResult = await (0, db_1.query)(`SELECT COUNT(*) as count
       FROM comments c
       JOIN posts p ON c.post_id = p.id
       WHERE c.user_id = $1 AND p.user_id = $2 AND c.created_at >= $3`, [viewerId, authorId, windowStart]);
        const commentsCount = parseInt(commentsResult.rows[0]?.count || '0');
        let score = 0.0;
        if (isMutualFollow) {
            score = 0.9;
        }
        else if (isFollowing) {
            score = 0.7;
        }
        else {
            score = 0.1;
        }
        const interactionBoost = Math.min(reactionsCount * 0.02 + commentsCount * 0.05, 0.25);
        score = Math.min(score + interactionBoost, 0.95);
        return score;
    }
    async getUserInterestProfile(userId) {
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - ranking_1.RANKING_CONFIG.INTEREST_WINDOW_DAYS);
        const interests = {};
        const reactedPostsResult = await (0, db_1.query)(`SELECT DISTINCT p.text
       FROM reactions r
       JOIN posts p ON r.post_id = p.id
       WHERE r.user_id = $1 AND r.created_at >= $2 AND r.comment_id IS NULL AND p.text IS NOT NULL`, [userId, windowStart]);
        reactedPostsResult.rows.forEach(row => {
            const hashtags = this.extractHashtags(row.text);
            hashtags.forEach(tag => {
                interests[tag] = (interests[tag] || 0) + 2.0;
            });
        });
        const commentedPostsResult = await (0, db_1.query)(`SELECT DISTINCT p.text
       FROM comments c
       JOIN posts p ON c.post_id = p.id
       WHERE c.user_id = $1 AND c.created_at >= $2 AND p.text IS NOT NULL`, [userId, windowStart]);
        commentedPostsResult.rows.forEach(row => {
            const hashtags = this.extractHashtags(row.text);
            hashtags.forEach(tag => {
                interests[tag] = (interests[tag] || 0) + 3.0;
            });
        });
        const viewedPostsResult = await (0, db_1.query)(`SELECT DISTINCT p.text
       FROM views v
       JOIN posts p ON v.post_id = p.id
       WHERE v.user_id = $1 AND v.created_at >= $2 AND p.text IS NOT NULL`, [userId, windowStart]);
        viewedPostsResult.rows.forEach(row => {
            const hashtags = this.extractHashtags(row.text);
            hashtags.forEach(tag => {
                interests[tag] = (interests[tag] || 0) + 0.5;
            });
        });
        return interests;
    }
    async computePersonalizationScore(post, userInterestProfile) {
        const postHashtags = this.extractHashtags(post.text);
        if (postHashtags.length === 0) {
            return 0.3;
        }
        let totalScore = 0.0;
        let matchedTags = 0;
        postHashtags.forEach(tag => {
            if (userInterestProfile[tag]) {
                totalScore += userInterestProfile[tag];
                matchedTags++;
            }
        });
        if (matchedTags === 0) {
            return 0.2;
        }
        const avgScore = totalScore / matchedTags;
        return Math.min(avgScore / 10.0, 1.0);
    }
    async computeEngagementScore(postId, postCreatedAt) {
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - ranking_1.RANKING_CONFIG.ENGAGEMENT_WINDOW_DAYS);
        const reactionsResult = await (0, db_1.query)(`SELECT COUNT(*) as count
       FROM reactions
       WHERE post_id = $1 AND created_at >= $2 AND comment_id IS NULL`, [postId, windowStart]);
        const reactionsCount = parseInt(reactionsResult.rows[0]?.count || '0');
        const commentsResult = await (0, db_1.query)(`SELECT COUNT(*) as count
       FROM comments
       WHERE post_id = $1 AND created_at >= $2`, [postId, windowStart]);
        const commentsCount = parseInt(commentsResult.rows[0]?.count || '0');
        const viewsResult = await (0, db_1.query)(`SELECT COUNT(*) as count
       FROM views
       WHERE post_id = $1 AND created_at >= $2`, [postId, windowStart]);
        const viewsCount = parseInt(viewsResult.rows[0]?.count || '0');
        const hoursSincePost = (Date.now() - postCreatedAt.getTime()) / (1000 * 60 * 60);
        const ageNormalization = Math.max(1.0, hoursSincePost / 24);
        const weightedEngagement = reactionsCount * 2.0 +
            commentsCount * 3.0 +
            viewsCount * 0.1;
        const normalizedScore = Math.min(weightedEngagement / (ageNormalization * 10), 1.0);
        return normalizedScore;
    }
    computeRecencyScore(postCreatedAt) {
        const hoursSincePost = (Date.now() - postCreatedAt.getTime()) / (1000 * 60 * 60);
        const halfLife = ranking_1.RANKING_CONFIG.RECENCY_DECAY_HALF_LIFE_HOURS;
        const score = Math.exp(-hoursSincePost / halfLife);
        return Math.max(0.0, Math.min(1.0, score));
    }
    async computeNegativeFeedbackScore(userId, postId) {
        const hiddenResult = await (0, db_1.query)('SELECT 1 FROM hidden_posts WHERE user_id = $1 AND post_id = $2', [userId, postId]);
        if (hiddenResult.rows.length > 0) {
            return -1.0;
        }
        const notInterestedResult = await (0, db_1.query)('SELECT 1 FROM not_interested_posts WHERE user_id = $1 AND post_id = $2', [userId, postId]);
        if (notInterestedResult.rows.length > 0) {
            return -1.0;
        }
        const reportedResult = await (0, db_1.query)('SELECT 1 FROM reported_posts WHERE user_id = $1 AND post_id = $2', [userId, postId]);
        if (reportedResult.rows.length > 0) {
            return -1.0;
        }
        const globalReportsResult = await (0, db_1.query)('SELECT COUNT(*) as count FROM reported_posts WHERE post_id = $1', [postId]);
        const reportCount = parseInt(globalReportsResult.rows[0]?.count || '0');
        if (reportCount >= 5) {
            return -0.5;
        }
        return 0.0;
    }
    applyAuthorDiversity(rankedPosts, maxConsecutive = ranking_1.RANKING_CONFIG.MAX_CONSECUTIVE_SAME_AUTHOR) {
        const result = [];
        const authorCounts = new Map();
        for (const post of rankedPosts) {
            const authorId = post.user_id;
            const consecutiveCount = authorCounts.get(authorId) || 0;
            if (consecutiveCount >= maxConsecutive) {
                if (post._rankingScore !== undefined) {
                    post._rankingScore *= 0.9;
                }
                authorCounts.set(authorId, 0);
            }
            else {
                authorCounts.set(authorId, consecutiveCount + 1);
            }
            result.push(post);
        }
        return result;
    }
    async generateHomeFeedCandidates(userId, limit = ranking_1.RANKING_CONFIG.MAX_CANDIDATES) {
        const startTime = Date.now();
        middlewares_1.logger.info('[RankingService] generateHomeFeedCandidates - START', {
            userId,
            limit,
        });
        const windowStart = null;
        const followedStart = Date.now();
        const followedUsersResult = await (0, db_1.query)('SELECT following_id FROM follows WHERE follower_id = $1', [userId]);
        const followedUserIds = followedUsersResult.rows.map(r => r.following_id);
        middlewares_1.logger.info('[RankingService] generateHomeFeedCandidates - Step 1: Followed users', {
            count: followedUserIds.length,
            duration: `${Date.now() - followedStart}ms`,
        });
        const mutualStart = Date.now();
        const mutualFollowersResult = await (0, db_1.query)('SELECT follower_id FROM follows WHERE following_id = $1', [userId]);
        const mutualFollowerIds = mutualFollowersResult.rows.map(r => r.follower_id);
        middlewares_1.logger.info('[RankingService] generateHomeFeedCandidates - Step 2: Mutual followers', {
            count: mutualFollowerIds.length,
            duration: `${Date.now() - mutualStart}ms`,
        });
        const secondDegreeIds = [];
        middlewares_1.logger.info('[RankingService] generateHomeFeedCandidates - Step 3: Skipping second-degree (performance)');
        const candidateAuthorIds = [
            userId,
            ...followedUserIds,
            ...mutualFollowerIds,
            ...secondDegreeIds,
        ];
        const uniqueAuthorIds = Array.from(new Set(candidateAuthorIds));
        const limitedAuthorIds = uniqueAuthorIds.slice(0, 100);
        console.log('🔵 [RankingService] Author IDs', {
            total: uniqueAuthorIds.length,
            limited: limitedAuthorIds.length,
        });
        let queryText;
        let queryParams;
        if (limitedAuthorIds.length === 0) {
            middlewares_1.logger.warn('[RankingService] No author IDs, returning empty array');
            return [];
        }
        if (limitedAuthorIds.length === 1 && limitedAuthorIds[0] === userId) {
            queryText = `
        SELECT p.id, p.user_id, p.text, p.media_url, p.media_type, p.visibility, p.feeling, p.location, p.created_at, p.updated_at,
               u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
        FROM (
          SELECT id, user_id, text, media_url, media_type, visibility, feeling, location, created_at, updated_at
          FROM posts
          WHERE visibility = 'public'
          ORDER BY created_at DESC
          LIMIT $1
        ) p
        INNER JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
      `;
            queryParams = [limit];
            console.log('🔵 [RankingService] Executing query for user with no connections');
        }
        else {
            queryText = `
        SELECT DISTINCT p.*, u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
        FROM posts p
        INNER JOIN users u ON p.user_id = u.id
        WHERE p.user_id = ANY($1::uuid[])
          AND (
            p.visibility = 'public'
            OR (p.visibility = 'followers' AND p.user_id = ANY($1::uuid[]))
            OR p.user_id = $2
          )
        ORDER BY p.created_at DESC
        LIMIT $3
      `;
            queryParams = [limitedAuthorIds, userId, limit];
            console.log('🔵 [RankingService] Executing query for users with connections', {
                authorCount: limitedAuthorIds.length,
                limit,
            });
        }
        const queryStart = Date.now();
        console.log('🔵 [RankingService] About to execute posts query', {
            hasConnections: limitedAuthorIds.length > 1,
            authorCount: limitedAuthorIds.length,
        });
        let result;
        try {
            result = await (0, db_1.query)(queryText, queryParams);
        }
        catch (queryError) {
            console.error('🔴 [RankingService] Query failed:', {
                error: queryError.message,
                code: queryError.code,
            });
            throw queryError;
        }
        const queryTime = Date.now() - queryStart;
        console.log('🟢 [RankingService] Query completed', {
            rowCount: result.rows.length,
            duration: `${queryTime}ms`,
        });
        middlewares_1.logger.info('[RankingService] generateHomeFeedCandidates - Step 4: Posts query', {
            rowCount: result.rows.length,
            duration: `${queryTime}ms`,
            totalDuration: `${Date.now() - startTime}ms`,
        });
        return result.rows.map(row => ({
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
    async generateExploreCandidates(userId, limit = ranking_1.RANKING_CONFIG.MAX_CANDIDATES) {
        const startTime = Date.now();
        console.log('🔵 [RankingService] generateExploreCandidates - START', {
            userId,
            limit,
        });
        const windowStart = null;
        const isAnonymous = userId === '00000000-0000-0000-0000-000000000000';
        let followedUserIds = [];
        if (!isAnonymous) {
            const followedStart = Date.now();
            const followedUsersResult = await (0, db_1.query)('SELECT following_id FROM follows WHERE follower_id = $1', [userId]);
            followedUserIds = followedUsersResult.rows.map(r => r.following_id);
            console.log('🔵 [RankingService] generateExploreCandidates - Followed users', {
                count: followedUserIds.length,
                duration: `${Date.now() - followedStart}ms`,
            });
        }
        let queryText;
        let queryParams;
        if (isAnonymous) {
            queryText = `
        SELECT p.id, p.user_id, p.text, p.media_url, p.media_type, p.visibility, p.feeling, p.location, p.created_at, p.updated_at,
               u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
        FROM (
          SELECT id, user_id, text, media_url, media_type, visibility, feeling, location, created_at, updated_at
          FROM posts
          WHERE visibility = 'public'
          ORDER BY created_at DESC
          LIMIT $1
        ) p
        INNER JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
      `;
            queryParams = [limit];
            console.log('🔵 [RankingService] generateExploreCandidates - Anonymous user query');
        }
        else if (followedUserIds.length > 0) {
            queryText = `
        SELECT p.id, p.user_id, p.text, p.media_url, p.media_type, p.visibility, p.feeling, p.location, p.created_at, p.updated_at,
               u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
        FROM (
          SELECT id, user_id, text, media_url, media_type, visibility, feeling, location, created_at, updated_at
          FROM posts
          WHERE visibility = 'public'
            AND user_id != $1
            AND user_id != ALL($2::uuid[])
          ORDER BY created_at DESC
          LIMIT $3
        ) p
        INNER JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
      `;
            queryParams = [userId, followedUserIds, limit];
            console.log('🔵 [RankingService] generateExploreCandidates - Excluding followed users', {
                followedCount: followedUserIds.length,
                limit,
            });
        }
        else {
            queryText = `
        SELECT p.id, p.user_id, p.text, p.media_url, p.media_type, p.visibility, p.feeling, p.location, p.created_at, p.updated_at,
               u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
        FROM (
          SELECT id, user_id, text, media_url, media_type, visibility, feeling, location, created_at, updated_at
          FROM posts
          WHERE visibility = 'public'
            AND user_id != $1
          ORDER BY created_at DESC
          LIMIT $2
        ) p
        INNER JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
      `;
            queryParams = [userId, limit];
            console.log('🔵 [RankingService] generateExploreCandidates - No followed users, excluding self');
        }
        const queryStart = Date.now();
        const result = await (0, db_1.query)(queryText, queryParams);
        const queryTime = Date.now() - queryStart;
        console.log('🟢 [RankingService] generateExploreCandidates - Query completed', {
            rowCount: result.rows.length,
            duration: `${queryTime}ms`,
            totalDuration: `${Date.now() - startTime}ms`,
        });
        return result.rows.map(row => ({
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
    async rankPosts(posts, userId, weights, includeDebug = false) {
        if (posts.length === 0) {
            return [];
        }
        const userInterestProfile = await this.getUserInterestProfile(userId);
        const rankedPosts = await Promise.all(posts.map(async (post) => {
            const [relationshipScore, engagementScore, personalizationScore, recencyScore, negativeFeedbackScore,] = await Promise.all([
                this.computeRelationshipScore(userId, post.user_id),
                this.computeEngagementScore(post.id, post.created_at),
                this.computePersonalizationScore(post, userInterestProfile),
                Promise.resolve(this.computeRecencyScore(post.created_at)),
                this.computeNegativeFeedbackScore(userId, post.id),
            ]);
            const finalScore = weights.relationship * relationshipScore +
                weights.engagement * engagementScore +
                weights.personalization * personalizationScore +
                weights.recency * recencyScore +
                weights.negativeFeedback * Math.max(negativeFeedbackScore, 0);
            const rankedPost = {
                ...post,
                _rankingScore: finalScore,
            };
            if (includeDebug) {
                rankedPost._rankingDebug = {
                    relationshipScore,
                    engagementScore,
                    personalizationScore,
                    recencyScore,
                    negativeFeedbackScore,
                    finalScore,
                };
            }
            return rankedPost;
        }));
        const filteredPosts = rankedPosts.filter(post => post._rankingScore !== undefined && post._rankingScore > -0.5);
        filteredPosts.sort((a, b) => {
            const scoreA = a._rankingScore || 0;
            const scoreB = b._rankingScore || 0;
            return scoreB - scoreA;
        });
        const diversifiedPosts = this.applyAuthorDiversity(filteredPosts);
        return diversifiedPosts;
    }
    async getRankedHomeFeed(userId, pagination) {
        const startTime = Date.now();
        middlewares_1.logger.info('[RankingService] getRankedHomeFeed - START', {
            userId,
            page: pagination.page,
            limit: pagination.limit,
        });
        try {
            const candidateLimit = Math.min(30, pagination.limit * 2);
            middlewares_1.logger.info('[RankingService] getRankedHomeFeed - Step 1: Generating candidates', { candidateLimit });
            const candidatesStart = Date.now();
            const candidates = await this.generateHomeFeedCandidates(userId, candidateLimit);
            const candidatesTime = Date.now() - candidatesStart;
            middlewares_1.logger.info('[RankingService] getRankedHomeFeed - Step 2: Candidates generated', {
                candidateCount: candidates.length,
                duration: `${candidatesTime}ms`,
            });
            if (candidates.length === 0) {
                middlewares_1.logger.info('[RankingService] getRankedHomeFeed - No candidates, returning empty');
                return {
                    posts: [],
                    page: pagination.page,
                    limit: pagination.limit,
                };
            }
            const sortStart = Date.now();
            const sortedCandidates = candidates.sort((a, b) => {
                const timeA = new Date(a.created_at).getTime();
                const timeB = new Date(b.created_at).getTime();
                return timeB - timeA;
            });
            middlewares_1.logger.info('[RankingService] getRankedHomeFeed - Step 3: Sorted candidates', {
                duration: `${Date.now() - sortStart}ms`,
            });
            const offset = (pagination.page - 1) * pagination.limit;
            const paginatedPosts = sortedCandidates.slice(offset, offset + pagination.limit);
            const cleanPosts = paginatedPosts.map(post => {
                const { _rankingScore, _rankingDebug, ...cleanPost } = post;
                return cleanPost;
            });
            const duration = Date.now() - startTime;
            middlewares_1.logger.info('[RankingService] getRankedHomeFeed - COMPLETE', {
                duration: `${duration}ms`,
                candidateCount: candidates.length,
                returnedCount: cleanPosts.length,
            });
            if (duration > 1000) {
                middlewares_1.logger.warn(`[RankingService] getRankedHomeFeed took ${duration}ms for ${candidates.length} candidates`);
            }
            return {
                posts: cleanPosts,
                page: pagination.page,
                limit: pagination.limit,
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            middlewares_1.logger.error('[RankingService] getRankedHomeFeed - ERROR:', {
                error: error.message,
                stack: error.stack,
                duration: `${duration}ms`,
                userId,
                page: pagination.page,
            });
            return {
                posts: [],
                page: pagination.page,
                limit: pagination.limit,
            };
        }
    }
    async getRankedExploreFeed(userId, pagination) {
        const startTime = Date.now();
        console.log('🔵 [RankingService] getRankedExploreFeed - START', {
            userId,
            page: pagination.page,
            limit: pagination.limit,
        });
        try {
            const candidateLimit = Math.min(100, pagination.limit * 5);
            console.log('🔵 [RankingService] getRankedExploreFeed - Generating candidates', { candidateLimit });
            const candidatesStart = Date.now();
            let candidates = await this.generateExploreCandidates(userId, candidateLimit);
            const candidatesTime = Date.now() - candidatesStart;
            console.log('🔵 [RankingService] getRankedExploreFeed - Candidates generated', {
                candidateCount: candidates.length,
                duration: `${candidatesTime}ms`,
            });
            if (candidates.length < 5 &&
                userId !== '00000000-0000-0000-0000-000000000000') {
                console.log('🔵 [RankingService] getRankedExploreFeed - Few candidates, trying without time window...');
                const isAnonymous = false;
                let followedUserIds = [];
                const followedUsersResult = await (0, db_1.query)('SELECT following_id FROM follows WHERE follower_id = $1', [userId]);
                followedUserIds = followedUsersResult.rows.map(r => r.following_id);
                let fallbackQuery;
                let fallbackParams;
                if (followedUserIds.length > 0) {
                    fallbackQuery = `
            SELECT p.id, p.user_id, p.text, p.media_url, p.media_type, p.visibility, p.feeling, p.location, p.created_at, p.updated_at,
                   u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
            FROM (
              SELECT id, user_id, text, media_url, media_type, visibility, feeling, location, created_at, updated_at
              FROM posts
              WHERE visibility = 'public'
                AND user_id != $1
                AND user_id != ALL($2::uuid[])
              ORDER BY created_at DESC
              LIMIT $3
            ) p
            INNER JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
          `;
                    fallbackParams = [userId, followedUserIds, candidateLimit];
                }
                else {
                    fallbackQuery = `
            SELECT p.id, p.user_id, p.text, p.media_url, p.media_type, p.visibility, p.feeling, p.location, p.created_at, p.updated_at,
                   u.id as user_id_for_join, u.username, u.display_name, u.avatar_url
            FROM (
              SELECT id, user_id, text, media_url, media_type, visibility, feeling, location, created_at, updated_at
              FROM posts
              WHERE visibility = 'public'
                AND user_id != $1
              ORDER BY created_at DESC
              LIMIT $2
            ) p
            INNER JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
          `;
                    fallbackParams = [userId, candidateLimit];
                }
                const fallbackResult = await (0, db_1.query)(fallbackQuery, fallbackParams, 12000);
                candidates = fallbackResult.rows.map(row => ({
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
                console.log('🟢 [RankingService] getRankedExploreFeed - Fallback query returned', candidates.length, 'posts');
            }
            if (candidates.length === 0) {
                console.log('🔵 [RankingService] getRankedExploreFeed - No candidates, returning empty');
                return {
                    posts: [],
                    page: pagination.page,
                    limit: pagination.limit,
                };
            }
            const sortStart = Date.now();
            const sortedCandidates = candidates.sort((a, b) => {
                const timeA = new Date(a.created_at).getTime();
                const timeB = new Date(b.created_at).getTime();
                return timeB - timeA;
            });
            console.log('🔵 [RankingService] getRankedExploreFeed - Sorted candidates', {
                duration: `${Date.now() - sortStart}ms`,
            });
            const offset = (pagination.page - 1) * pagination.limit;
            const paginatedPosts = sortedCandidates.slice(offset, offset + pagination.limit);
            const cleanPosts = paginatedPosts.map(post => {
                const { _rankingScore, _rankingDebug, ...cleanPost } = post;
                return cleanPost;
            });
            const duration = Date.now() - startTime;
            console.log('🟢 [RankingService] getRankedExploreFeed - COMPLETE', {
                duration: `${duration}ms`,
                candidateCount: candidates.length,
                returnedCount: cleanPosts.length,
            });
            return {
                posts: cleanPosts,
                page: pagination.page,
                limit: pagination.limit,
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            console.error('🔴 [RankingService] getRankedExploreFeed - ERROR:', {
                error: error.message,
                stack: error.stack,
                name: error.name,
                code: error.code,
                duration: `${duration}ms`,
            });
            middlewares_1.logger.error('[RankingService] getRankedExploreFeed - ERROR:', {
                error: error.message,
                stack: error.stack,
                duration: `${duration}ms`,
                userId,
                pagination,
            });
            return {
                posts: [],
                page: pagination.page,
                limit: pagination.limit,
            };
        }
    }
    async rankSearchResults(rawResults, userId, searchQuery) {
        if (!userId || rawResults.length === 0) {
            return rawResults;
        }
        const queryLower = searchQuery.toLowerCase();
        const postsWithRelevance = rawResults.map(post => {
            let textRelevance = 0.0;
            if (post.text) {
                const textLower = post.text.toLowerCase();
                if (textLower.includes(queryLower)) {
                    textRelevance = 0.8;
                    const occurrences = (textLower.match(new RegExp(queryLower, 'g')) || []).length;
                    textRelevance = Math.min(0.8 + occurrences * 0.1, 1.0);
                }
            }
            const hashtags = this.extractHashtags(post.text);
            if (hashtags.some(tag => tag.includes(queryLower))) {
                textRelevance = Math.max(textRelevance, 0.9);
            }
            return {
                ...post,
                _textRelevance: textRelevance,
            };
        });
        postsWithRelevance.sort((a, b) => {
            const relA = a._textRelevance || 0;
            const relB = b._textRelevance || 0;
            return relB - relA;
        });
        const topCandidates = postsWithRelevance.slice(0, ranking_1.RANKING_CONFIG.MAX_CANDIDATES);
        const rankedPosts = await this.rankPosts(topCandidates, userId, ranking_1.SEARCH_WEIGHTS);
        const blendedPosts = rankedPosts.map(post => {
            const textRel = post._textRelevance || 0.5;
            const socialScore = post._rankingScore || 0;
            const blendedScore = textRel * 0.6 + socialScore * 0.4;
            return {
                ...post,
                _rankingScore: blendedScore,
            };
        });
        blendedPosts.sort((a, b) => {
            const scoreA = a._rankingScore || 0;
            const scoreB = b._rankingScore || 0;
            return scoreB - scoreA;
        });
        return blendedPosts.map(post => {
            const { _rankingScore, _rankingDebug, _textRelevance, ...cleanPost } = post;
            return cleanPost;
        });
    }
}
exports.FeedRankingService = FeedRankingService;
//# sourceMappingURL=feedRankingService.js.map