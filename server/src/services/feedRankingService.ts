import { query } from '../models/db';
import { logger } from '../middlewares';
import {
  RankingWeights,
  HOME_FEED_WEIGHTS,
  EXPLORE_WEIGHTS,
  SEARCH_WEIGHTS,
  RANKING_CONFIG,
} from '../config/ranking';
import { Post } from './postsService';

/**
 * Post with ranking metadata
 */
export interface RankedPost extends Post {
  _rankingScore?: number;
  _rankingDebug?: {
    relationshipScore: number;
    engagementScore: number;
    personalizationScore: number;
    recencyScore: number;
    negativeFeedbackScore: number;
    finalScore: number;
  };
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Relationship strength between two users
 */
interface RelationshipData {
  isFollowing: boolean;
  isMutualFollow: boolean;
  reactionsFromUser: number;
  commentsFromUser: number;
  relationshipScore: number;
}

/**
 * User interest profile (hashtag -> score)
 */
interface UserInterestProfile {
  [hashtag: string]: number;
}

/**
 * Post engagement metrics
 */
interface EngagementMetrics {
  reactionsCount: number;
  commentsCount: number;
  viewsCount: number;
  engagementScore: number;
}

/**
 * Feed Ranking Service
 *
 * Implements a 3-stage ranking pipeline:
 * 1. Candidate Generation - Efficient DB queries to get relevant posts
 * 2. Scoring - Compute features and combine into final score
 * 3. Post-processing - Apply diversity, filters, pagination
 */
export class FeedRankingService {
  /**
   * Extract hashtags from text
   */
  private extractHashtags(text?: string): string[] {
    if (!text) return [];
    const hashtagRegex = /#(\w+)/g;
    const matches = Array.from(text.matchAll(hashtagRegex));
    return matches.map(m => `#${m[1].toLowerCase()}`);
  }

  /**
   * Compute relationship strength between viewer and author
   */
  async computeRelationshipScore(
    viewerId: string,
    authorId: string
  ): Promise<number> {
    if (viewerId === authorId) {
      return 1.0; // Own posts get highest score
    }

    const windowStart = new Date();
    windowStart.setDate(
      windowStart.getDate() - RANKING_CONFIG.RELATIONSHIP_WINDOW_DAYS
    );

    // Check follow status
    const followResult = await query(
      `SELECT 
        EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2) as is_following,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = $1) as is_followed_by`,
      [viewerId, authorId]
    );

    const isFollowing = followResult.rows[0]?.is_following || false;
    const isMutualFollow =
      isFollowing && (followResult.rows[0]?.is_followed_by || false);

    // Count interactions: reactions from viewer on author's posts
    const reactionsResult = await query(
      `SELECT COUNT(*) as count
       FROM reactions r
       JOIN posts p ON r.post_id = p.id
       WHERE r.user_id = $1 AND p.user_id = $2 AND r.created_at >= $3 AND r.comment_id IS NULL`,
      [viewerId, authorId, windowStart]
    );
    const reactionsCount = parseInt(reactionsResult.rows[0]?.count || '0');

    // Count comments from viewer on author's posts
    const commentsResult = await query(
      `SELECT COUNT(*) as count
       FROM comments c
       JOIN posts p ON c.post_id = p.id
       WHERE c.user_id = $1 AND p.user_id = $2 AND c.created_at >= $3`,
      [viewerId, authorId, windowStart]
    );
    const commentsCount = parseInt(commentsResult.rows[0]?.count || '0');

    // Compute relationship score
    let score = 0.0;

    if (isMutualFollow) {
      score = 0.9; // Mutual follow = very strong relationship
    } else if (isFollowing) {
      score = 0.7; // Following = strong relationship
    } else {
      score = 0.1; // Not following = weak relationship
    }

    // Boost based on interactions (capped at 0.95)
    const interactionBoost = Math.min(
      reactionsCount * 0.02 + commentsCount * 0.05,
      0.25
    );
    score = Math.min(score + interactionBoost, 0.95);

    return score;
  }

  /**
   * Build user interest profile from their interactions
   */
  async getUserInterestProfile(userId: string): Promise<UserInterestProfile> {
    const windowStart = new Date();
    windowStart.setDate(
      windowStart.getDate() - RANKING_CONFIG.INTEREST_WINDOW_DAYS
    );

    const interests: UserInterestProfile = {};

    // Get hashtags from posts user reacted to
    const reactedPostsResult = await query(
      `SELECT DISTINCT p.text
       FROM reactions r
       JOIN posts p ON r.post_id = p.id
       WHERE r.user_id = $1 AND r.created_at >= $2 AND r.comment_id IS NULL AND p.text IS NOT NULL`,
      [userId, windowStart]
    );

    reactedPostsResult.rows.forEach(row => {
      const hashtags = this.extractHashtags(row.text);
      hashtags.forEach(tag => {
        interests[tag] = (interests[tag] || 0) + 2.0; // Reactions are strong signal
      });
    });

    // Get hashtags from posts user commented on
    const commentedPostsResult = await query(
      `SELECT DISTINCT p.text
       FROM comments c
       JOIN posts p ON c.post_id = p.id
       WHERE c.user_id = $1 AND c.created_at >= $2 AND p.text IS NOT NULL`,
      [userId, windowStart]
    );

    commentedPostsResult.rows.forEach(row => {
      const hashtags = this.extractHashtags(row.text);
      hashtags.forEach(tag => {
        interests[tag] = (interests[tag] || 0) + 3.0; // Comments are even stronger
      });
    });

    // Get hashtags from posts user viewed (if we have view data)
    const viewedPostsResult = await query(
      `SELECT DISTINCT p.text
       FROM views v
       JOIN posts p ON v.post_id = p.id
       WHERE v.user_id = $1 AND v.created_at >= $2 AND p.text IS NOT NULL`,
      [userId, windowStart]
    );

    viewedPostsResult.rows.forEach(row => {
      const hashtags = this.extractHashtags(row.text);
      hashtags.forEach(tag => {
        interests[tag] = (interests[tag] || 0) + 0.5; // Views are weaker signal
      });
    });

    // Normalize scores (optional: could use top N only)
    return interests;
  }

  /**
   * Compute personalization score based on user interests
   */
  async computePersonalizationScore(
    post: Post,
    userInterestProfile: UserInterestProfile
  ): Promise<number> {
    const postHashtags = this.extractHashtags(post.text);

    if (postHashtags.length === 0) {
      return 0.3; // Neutral score for posts without hashtags
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
      return 0.2; // Low score if no matching interests
    }

    // Normalize: average interest score, capped at 1.0
    const avgScore = totalScore / matchedTags;
    return Math.min(avgScore / 10.0, 1.0); // Normalize assuming max interest score ~10
  }

  /**
   * Compute engagement score for a post
   */
  async computeEngagementScore(
    postId: string,
    postCreatedAt: Date
  ): Promise<number> {
    const windowStart = new Date();
    windowStart.setDate(
      windowStart.getDate() - RANKING_CONFIG.ENGAGEMENT_WINDOW_DAYS
    );

    // Get reactions count
    const reactionsResult = await query(
      `SELECT COUNT(*) as count
       FROM reactions
       WHERE post_id = $1 AND created_at >= $2 AND comment_id IS NULL`,
      [postId, windowStart]
    );
    const reactionsCount = parseInt(reactionsResult.rows[0]?.count || '0');

    // Get comments count
    const commentsResult = await query(
      `SELECT COUNT(*) as count
       FROM comments
       WHERE post_id = $1 AND created_at >= $2`,
      [postId, windowStart]
    );
    const commentsCount = parseInt(commentsResult.rows[0]?.count || '0');

    // Get views count
    const viewsResult = await query(
      `SELECT COUNT(*) as count
       FROM views
       WHERE post_id = $1 AND created_at >= $2`,
      [postId, windowStart]
    );
    const viewsCount = parseInt(viewsResult.rows[0]?.count || '0');

    // Compute engagement score with age normalization
    const hoursSincePost =
      (Date.now() - postCreatedAt.getTime()) / (1000 * 60 * 60);
    const ageNormalization = Math.max(1.0, hoursSincePost / 24); // Older posts need more engagement

    const weightedEngagement =
      reactionsCount * 2.0 + // Reactions are strong signal
      commentsCount * 3.0 + // Comments are even stronger
      viewsCount * 0.1; // Views are weaker signal

    // Normalize by age and cap at 1.0
    const normalizedScore = Math.min(
      weightedEngagement / (ageNormalization * 10),
      1.0
    );
    return normalizedScore;
  }

  /**
   * Compute recency score (exponential decay)
   */
  computeRecencyScore(postCreatedAt: Date): number {
    const hoursSincePost =
      (Date.now() - postCreatedAt.getTime()) / (1000 * 60 * 60);

    // Exponential decay: score = e^(-hours / half_life)
    const halfLife = RANKING_CONFIG.RECENCY_DECAY_HALF_LIFE_HOURS;
    const score = Math.exp(-hoursSincePost / halfLife);

    return Math.max(0.0, Math.min(1.0, score));
  }

  /**
   * Compute negative feedback score
   */
  async computeNegativeFeedbackScore(
    userId: string,
    postId: string
  ): Promise<number> {
    // Check if user hid this post
    const hiddenResult = await query(
      'SELECT 1 FROM hidden_posts WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );
    if (hiddenResult.rows.length > 0) {
      return -1.0; // Strong negative
    }

    // Check if user marked as not interested
    const notInterestedResult = await query(
      'SELECT 1 FROM not_interested_posts WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );
    if (notInterestedResult.rows.length > 0) {
      return -1.0; // Strong negative
    }

    // Check if user reported this post
    const reportedResult = await query(
      'SELECT 1 FROM reported_posts WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );
    if (reportedResult.rows.length > 0) {
      return -1.0; // Strong negative
    }

    // Check global report count (down-rank heavily reported posts)
    const globalReportsResult = await query(
      'SELECT COUNT(*) as count FROM reported_posts WHERE post_id = $1',
      [postId]
    );
    const reportCount = parseInt(globalReportsResult.rows[0]?.count || '0');

    if (reportCount >= 5) {
      return -0.5; // Moderate negative for heavily reported posts
    }

    return 0.0; // No negative feedback
  }

  /**
   * Apply author diversity penalty to avoid spam
   */
  applyAuthorDiversity(
    rankedPosts: RankedPost[],
    maxConsecutive: number = RANKING_CONFIG.MAX_CONSECUTIVE_SAME_AUTHOR
  ): RankedPost[] {
    const result: RankedPost[] = [];
    const authorCounts = new Map<string, number>();

    for (const post of rankedPosts) {
      const authorId = post.user_id;
      const consecutiveCount = authorCounts.get(authorId) || 0;

      if (consecutiveCount >= maxConsecutive) {
        // Apply penalty: reduce score by 10%
        if (post._rankingScore !== undefined) {
          post._rankingScore *= 0.9;
        }
        authorCounts.set(authorId, 0); // Reset counter after penalty
      } else {
        authorCounts.set(authorId, consecutiveCount + 1);
      }

      result.push(post);
    }

    return result;
  }

  /**
   * Generate candidates for Home Feed
   */
  async generateHomeFeedCandidates(
    userId: string,
    limit: number = RANKING_CONFIG.MAX_CANDIDATES
  ): Promise<Post[]> {
    const startTime = Date.now();
    logger.info('[RankingService] generateHomeFeedCandidates - START', {
      userId,
      limit,
    });

    // Remove time window restriction to show all posts
    // This ensures users can see all available content
    const windowStart = null; // No time restriction

    // Get followed users
    const followedStart = Date.now();
    const followedUsersResult = await query(
      'SELECT following_id FROM follows WHERE follower_id = $1',
      [userId]
    );
    const followedUserIds = followedUsersResult.rows.map(r => r.following_id);
    logger.info(
      '[RankingService] generateHomeFeedCandidates - Step 1: Followed users',
      {
        count: followedUserIds.length,
        duration: `${Date.now() - followedStart}ms`,
      }
    );

    // Get users who follow the viewer (mutual connections)
    const mutualStart = Date.now();
    const mutualFollowersResult = await query(
      'SELECT follower_id FROM follows WHERE following_id = $1',
      [userId]
    );
    const mutualFollowerIds = mutualFollowersResult.rows.map(
      r => r.follower_id
    );
    logger.info(
      '[RankingService] generateHomeFeedCandidates - Step 2: Mutual followers',
      {
        count: mutualFollowerIds.length,
        duration: `${Date.now() - mutualStart}ms`,
      }
    );

    // Skip second-degree connections for performance - they're expensive and not critical
    // This significantly speeds up the query
    const secondDegreeIds: string[] = [];
    logger.info(
      '[RankingService] generateHomeFeedCandidates - Step 3: Skipping second-degree (performance)'
    );

    // Combine all candidate author IDs (include self)
    const candidateAuthorIds = [
      userId, // Always include own posts
      ...followedUserIds,
      ...mutualFollowerIds,
      ...secondDegreeIds,
    ];

    // Remove duplicates
    const uniqueAuthorIds = Array.from(new Set(candidateAuthorIds));

    // Safety: Limit the number of authors to prevent slow queries
    // If user follows too many people, just use the first 100
    const limitedAuthorIds = uniqueAuthorIds.slice(0, 100);
    console.log('🔵 [RankingService] Author IDs', {
      total: uniqueAuthorIds.length,
      limited: limitedAuthorIds.length,
    });

    // If user has no connections, fall back to showing public posts from all users
    // This ensures new users still see content
    let queryText: string;
    let queryParams: any[];

    // Safety check: ensure we have valid author IDs
    if (limitedAuthorIds.length === 0) {
      logger.warn('[RankingService] No author IDs, returning empty array');
      return [];
    }

    if (limitedAuthorIds.length === 1 && limitedAuthorIds[0] === userId) {
      // User has no connections - show public posts from all users
      // Highly optimized: Use subquery to limit posts first, then join (much faster)
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
      console.log(
        '🔵 [RankingService] Executing query for user with no connections'
      );
    } else {
      // User has connections - show posts from connections + own posts
      // Optimized: Simplified query and use INNER JOIN
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
      console.log(
        '🔵 [RankingService] Executing query for users with connections',
        {
          authorCount: limitedAuthorIds.length,
          limit,
        }
      );
    }

    const queryStart = Date.now();
    console.log('🔵 [RankingService] About to execute posts query', {
      hasConnections: limitedAuthorIds.length > 1,
      authorCount: limitedAuthorIds.length,
    });

    let result;
    try {
      result = await query(queryText, queryParams);
    } catch (queryError: any) {
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
    logger.info(
      '[RankingService] generateHomeFeedCandidates - Step 4: Posts query',
      {
        rowCount: result.rows.length,
        duration: `${queryTime}ms`,
        totalDuration: `${Date.now() - startTime}ms`,
      }
    );

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
    })) as Post[];
  }

  /**
   * Generate candidates for Explore Feed
   */
  async generateExploreCandidates(
    userId: string,
    limit: number = RANKING_CONFIG.MAX_CANDIDATES
  ): Promise<Post[]> {
    const startTime = Date.now();
    console.log('🔵 [RankingService] generateExploreCandidates - START', {
      userId,
      limit,
    });

    // Remove time window restriction for explore feed to show all content
    const windowStart = null; // No time restriction

    // Handle anonymous users (when userId is the dummy UUID)
    const isAnonymous = userId === '00000000-0000-0000-0000-000000000000';

    // Get followed users to exclude most of them (skip for anonymous users)
    let followedUserIds: string[] = [];
    if (!isAnonymous) {
      const followedStart = Date.now();
      const followedUsersResult = await query(
        'SELECT following_id FROM follows WHERE follower_id = $1',
        [userId]
      );
      followedUserIds = followedUsersResult.rows.map(r => r.following_id);
      console.log(
        '🔵 [RankingService] generateExploreCandidates - Followed users',
        {
          count: followedUserIds.length,
          duration: `${Date.now() - followedStart}ms`,
        }
      );
    }

    // Get posts from non-followed users
    // Optimized: Use subquery to limit posts first, then join (much faster)
    let queryText: string;
    let queryParams: any[];

    if (isAnonymous) {
      // For anonymous users, just get all public posts
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
      console.log(
        '🔵 [RankingService] generateExploreCandidates - Anonymous user query'
      );
    } else if (followedUserIds.length > 0) {
      // User follows people - exclude them from explore
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
      console.log(
        '🔵 [RankingService] generateExploreCandidates - Excluding followed users',
        {
          followedCount: followedUserIds.length,
          limit,
        }
      );
    } else {
      // User doesn't follow anyone - show all public posts except own
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
      console.log(
        '🔵 [RankingService] generateExploreCandidates - No followed users, excluding self'
      );
    }

    const queryStart = Date.now();
    const result = await query(queryText, queryParams);
    const queryTime = Date.now() - queryStart;
    console.log(
      '🟢 [RankingService] generateExploreCandidates - Query completed',
      {
        rowCount: result.rows.length,
        duration: `${queryTime}ms`,
        totalDuration: `${Date.now() - startTime}ms`,
      }
    );

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
    })) as Post[];
  }

  /**
   * Rank posts using the scoring algorithm
   */
  async rankPosts(
    posts: Post[],
    userId: string,
    weights: RankingWeights,
    includeDebug: boolean = false
  ): Promise<RankedPost[]> {
    if (posts.length === 0) {
      return [];
    }

    // Pre-compute user interest profile once
    const userInterestProfile = await this.getUserInterestProfile(userId);

    // Compute scores for all posts
    const rankedPosts: RankedPost[] = await Promise.all(
      posts.map(async (post): Promise<RankedPost> => {
        const [
          relationshipScore,
          engagementScore,
          personalizationScore,
          recencyScore,
          negativeFeedbackScore,
        ] = await Promise.all([
          this.computeRelationshipScore(userId, post.user_id),
          this.computeEngagementScore(post.id, post.created_at),
          this.computePersonalizationScore(post, userInterestProfile),
          Promise.resolve(this.computeRecencyScore(post.created_at)),
          this.computeNegativeFeedbackScore(userId, post.id),
        ]);

        // Compute final score
        const finalScore =
          weights.relationship * relationshipScore +
          weights.engagement * engagementScore +
          weights.personalization * personalizationScore +
          weights.recency * recencyScore +
          weights.negativeFeedback * Math.max(negativeFeedbackScore, 0); // Only apply if negative

        const rankedPost: RankedPost = {
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
      })
    );

    // Filter out posts with strong negative feedback
    const filteredPosts = rankedPosts.filter(
      post => post._rankingScore !== undefined && post._rankingScore > -0.5
    );

    // Sort by score (descending)
    filteredPosts.sort((a, b) => {
      const scoreA = a._rankingScore || 0;
      const scoreB = b._rankingScore || 0;
      return scoreB - scoreA;
    });

    // Apply author diversity
    const diversifiedPosts = this.applyAuthorDiversity(filteredPosts);

    return diversifiedPosts;
  }

  /**
   * Get ranked home feed
   * Optimized to prevent timeouts by limiting candidates and using simpler ranking
   */
  async getRankedHomeFeed(
    userId: string,
    pagination: PaginationParams
  ): Promise<{ posts: Post[]; page: number; limit: number }> {
    const startTime = Date.now();
    logger.info('[RankingService] getRankedHomeFeed - START', {
      userId,
      page: pagination.page,
      limit: pagination.limit,
    });

    try {
      // Severely limit candidate pool for performance (20-30 posts max)
      // We'll do simple ranking on these instead of complex scoring
      const candidateLimit = Math.min(30, pagination.limit * 2);
      logger.info(
        '[RankingService] getRankedHomeFeed - Step 1: Generating candidates',
        { candidateLimit }
      );

      // Generate candidates
      const candidatesStart = Date.now();
      const candidates = await this.generateHomeFeedCandidates(
        userId,
        candidateLimit
      );
      const candidatesTime = Date.now() - candidatesStart;
      logger.info(
        '[RankingService] getRankedHomeFeed - Step 2: Candidates generated',
        {
          candidateCount: candidates.length,
          duration: `${candidatesTime}ms`,
        }
      );

      // Early return if no candidates
      if (candidates.length === 0) {
        logger.info(
          '[RankingService] getRankedHomeFeed - No candidates, returning empty'
        );
        return {
          posts: [],
          page: pagination.page,
          limit: pagination.limit,
        };
      }

      // For performance, use simplified ranking instead of full algorithm
      // Sort by recency first (newest posts), then apply simple engagement boost
      const sortStart = Date.now();
      const sortedCandidates = candidates.sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return timeB - timeA; // Newest first
      });
      logger.info(
        '[RankingService] getRankedHomeFeed - Step 3: Sorted candidates',
        {
          duration: `${Date.now() - sortStart}ms`,
        }
      );

      // Take only what we need for this page
      const offset = (pagination.page - 1) * pagination.limit;
      const paginatedPosts = sortedCandidates.slice(
        offset,
        offset + pagination.limit
      );

      // Remove any ranking metadata if present (using type assertion since we know these posts don't have ranking metadata)
      const cleanPosts = paginatedPosts.map(post => {
        const { _rankingScore, _rankingDebug, ...cleanPost } = post as any;
        return cleanPost as Post;
      });

      const duration = Date.now() - startTime;
      logger.info('[RankingService] getRankedHomeFeed - COMPLETE', {
        duration: `${duration}ms`,
        candidateCount: candidates.length,
        returnedCount: cleanPosts.length,
      });

      if (duration > 1000) {
        logger.warn(
          `[RankingService] getRankedHomeFeed took ${duration}ms for ${candidates.length} candidates`
        );
      }

      return {
        posts: cleanPosts,
        page: pagination.page,
        limit: pagination.limit,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('[RankingService] getRankedHomeFeed - ERROR:', {
        error: error.message,
        stack: error.stack,
        duration: `${duration}ms`,
        userId,
        page: pagination.page,
      });
      // Return empty array on error instead of throwing
      return {
        posts: [],
        page: pagination.page,
        limit: pagination.limit,
      };
    }
  }

  /**
   * Get ranked explore feed
   * Optimized to prevent timeouts by using simplified ranking
   */
  async getRankedExploreFeed(
    userId: string,
    pagination: PaginationParams
  ): Promise<{ posts: Post[]; page: number; limit: number }> {
    const startTime = Date.now();
    console.log('🔵 [RankingService] getRankedExploreFeed - START', {
      userId,
      page: pagination.page,
      limit: pagination.limit,
    });

    try {
      // Limit candidate pool for performance - get more candidates for explore (up to 100)
      const candidateLimit = Math.min(100, pagination.limit * 5);
      console.log(
        '🔵 [RankingService] getRankedExploreFeed - Generating candidates',
        { candidateLimit }
      );

      // Generate candidates
      const candidatesStart = Date.now();
      let candidates = await this.generateExploreCandidates(
        userId,
        candidateLimit
      );
      const candidatesTime = Date.now() - candidatesStart;
      console.log(
        '🔵 [RankingService] getRankedExploreFeed - Candidates generated',
        {
          candidateCount: candidates.length,
          duration: `${candidatesTime}ms`,
        }
      );

      // If we got very few candidates, try without time window (for authenticated users)
      if (
        candidates.length < 5 &&
        userId !== '00000000-0000-0000-0000-000000000000'
      ) {
        console.log(
          '🔵 [RankingService] getRankedExploreFeed - Few candidates, trying without time window...'
        );
        // Retry with no time window but still exclude followed users
        const isAnonymous = false;
        let followedUserIds: string[] = [];
        const followedUsersResult = await query(
          'SELECT following_id FROM follows WHERE follower_id = $1',
          [userId]
        );
        followedUserIds = followedUsersResult.rows.map(r => r.following_id);

        let fallbackQuery: string;
        let fallbackParams: any[];

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
        } else {
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

        const fallbackResult = await query(
          fallbackQuery,
          fallbackParams,
          12000
        );
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
        })) as Post[];
        console.log(
          '🟢 [RankingService] getRankedExploreFeed - Fallback query returned',
          candidates.length,
          'posts'
        );
      }

      // Early return if no candidates
      if (candidates.length === 0) {
        console.log(
          '🔵 [RankingService] getRankedExploreFeed - No candidates, returning empty'
        );
        return {
          posts: [],
          page: pagination.page,
          limit: pagination.limit,
        };
      }

      // For performance, use simplified ranking instead of full algorithm
      // Sort by recency (newest posts first) - this is fast and effective for explore
      const sortStart = Date.now();
      const sortedCandidates = candidates.sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return timeB - timeA; // Newest first
      });
      console.log(
        '🔵 [RankingService] getRankedExploreFeed - Sorted candidates',
        {
          duration: `${Date.now() - sortStart}ms`,
        }
      );

      // Apply pagination
      const offset = (pagination.page - 1) * pagination.limit;
      const paginatedPosts = sortedCandidates.slice(
        offset,
        offset + pagination.limit
      );

      // Remove any ranking metadata if present (using type assertion since we know these posts don't have ranking metadata)
      const cleanPosts = paginatedPosts.map(post => {
        const { _rankingScore, _rankingDebug, ...cleanPost } = post as any;
        return cleanPost as Post;
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
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('🔴 [RankingService] getRankedExploreFeed - ERROR:', {
        error: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        duration: `${duration}ms`,
      });
      logger.error('[RankingService] getRankedExploreFeed - ERROR:', {
        error: error.message,
        stack: error.stack,
        duration: `${duration}ms`,
        userId,
        pagination,
      });
      // Return empty array on error instead of throwing
      return {
        posts: [],
        page: pagination.page,
        limit: pagination.limit,
      };
    }
  }

  /**
   * Rank search results
   */
  async rankSearchResults(
    rawResults: Post[],
    userId: string | undefined,
    searchQuery: string
  ): Promise<Post[]> {
    if (!userId || rawResults.length === 0) {
      // For anonymous users or empty results, return as-is
      return rawResults;
    }

    // Compute text relevance score (simple: posts with query in text rank higher)
    const queryLower = searchQuery.toLowerCase();
    const postsWithRelevance = rawResults.map(post => {
      let textRelevance = 0.0;

      if (post.text) {
        const textLower = post.text.toLowerCase();
        if (textLower.includes(queryLower)) {
          textRelevance = 0.8; // Good match
          // Boost if query appears multiple times or in hashtags
          const occurrences = (
            textLower.match(new RegExp(queryLower, 'g')) || []
          ).length;
          textRelevance = Math.min(0.8 + occurrences * 0.1, 1.0);
        }
      }

      // Check hashtags
      const hashtags = this.extractHashtags(post.text);
      if (hashtags.some(tag => tag.includes(queryLower))) {
        textRelevance = Math.max(textRelevance, 0.9); // Hashtag match is strong
      }

      return {
        ...post,
        _textRelevance: textRelevance,
      };
    });

    // Sort by text relevance first, then apply social ranking
    postsWithRelevance.sort((a, b) => {
      const relA = (a as any)._textRelevance || 0;
      const relB = (b as any)._textRelevance || 0;
      return relB - relA;
    });

    // Take top candidates and apply social ranking
    const topCandidates = postsWithRelevance.slice(
      0,
      RANKING_CONFIG.MAX_CANDIDATES
    );
    const rankedPosts = await this.rankPosts(
      topCandidates as Post[],
      userId,
      SEARCH_WEIGHTS
    );

    // Blend text relevance with social ranking
    const blendedPosts = rankedPosts.map(post => {
      const textRel = (post as any)._textRelevance || 0.5;
      const socialScore = post._rankingScore || 0;

      // Blend: 60% text relevance, 40% social ranking
      const blendedScore = textRel * 0.6 + socialScore * 0.4;

      return {
        ...post,
        _rankingScore: blendedScore,
      };
    });

    // Re-sort by blended score
    blendedPosts.sort((a, b) => {
      const scoreA = a._rankingScore || 0;
      const scoreB = b._rankingScore || 0;
      return scoreB - scoreA;
    });

    // Remove ranking metadata
    return blendedPosts.map(post => {
      const { _rankingScore, _rankingDebug, _textRelevance, ...cleanPost } =
        post as any;
      return cleanPost as Post;
    });
  }
}
