/**
 * Ranking Configuration
 * 
 * This file contains configurable weights for the ranking algorithm
 * used across different surfaces (Home Feed, Explore, Search).
 * 
 * To tune the algorithm, adjust these weights. Higher values mean
 * that feature has more influence on the final ranking.
 */

export interface RankingWeights {
  /** Weight for relationship strength (how close is the author to the viewer?) */
  relationship: number;
  
  /** Weight for engagement metrics (likes, comments, views) */
  engagement: number;
  
  /** Weight for personalization (matches user's interests) */
  personalization: number;
  
  /** Weight for recency (how fresh is the post?) */
  recency: number;
  
  /** Weight for negative feedback (hidden, reported, not interested) - should be negative */
  negativeFeedback: number;
  
  /** Penalty for author diversity (to avoid too many posts from same author) */
  authorDiversityPenalty: number;
}

/**
 * Home Feed Weights
 * 
 * Prioritizes:
 * - Strong relationships (friends, mutual follows) - HIGHEST
 * - Personalization (user interests)
 * - Recent engagement
 * - Freshness
 */
export const HOME_FEED_WEIGHTS: RankingWeights = {
  relationship: 0.5,        // Highest priority: friends first
  engagement: 0.2,          // Engagement matters but less than relationships
  personalization: 0.15,   // User interests are important
  recency: 0.1,             // Freshness matters but not dominant
  negativeFeedback: -1.0,  // Strong penalty for hidden/reported posts
  authorDiversityPenalty: 0.05, // Small penalty to avoid spam from same author
};

/**
 * Explore Feed Weights
 * 
 * Prioritizes:
 * - Trending content (high engagement)
 * - Personalization (but with discovery)
 * - Recency (what's hot now)
 * - Less focus on relationships
 */
export const EXPLORE_WEIGHTS: RankingWeights = {
  relationship: 0.1,        // Low: we want discovery, not just friends
  engagement: 0.35,        // High: trending content
  personalization: 0.25,   // Medium-high: match interests but allow discovery
  recency: 0.25,           // High: what's happening now
  negativeFeedback: -1.0,  // Strong penalty for hidden/reported posts
  authorDiversityPenalty: 0.05, // Prevent same author spam
};

/**
 * Search Results Weights
 * 
 * Prioritizes:
 * - Text relevance (handled separately, then blended)
 * - Relationship (friends' posts matching query rank higher)
 * - Engagement (quality signals)
 * - Personalization
 */
export const SEARCH_WEIGHTS: RankingWeights = {
  relationship: 0.2,        // Medium: friends' posts matter more
  engagement: 0.25,        // Medium-high: quality matters
  personalization: 0.2,     // Medium: interests matter
  recency: 0.15,           // Medium: freshness matters
  negativeFeedback: -1.0,  // Strong penalty
  authorDiversityPenalty: 0.05,
};

/**
 * Ranking Algorithm Parameters
 */
export const RANKING_CONFIG = {
  /** Maximum number of candidates to fetch before ranking */
  MAX_CANDIDATES: 400,
  
  /** Minimum number of candidates to fetch */
  MIN_CANDIDATES: 50,
  
  /** Time window for recent engagement (days) */
  ENGAGEMENT_WINDOW_DAYS: 7,
  
  /** Time window for relationship interactions (days) */
  RELATIONSHIP_WINDOW_DAYS: 30,
  
  /** Time window for interest profile (days) */
  INTEREST_WINDOW_DAYS: 30,
  
  /** Maximum number of consecutive posts from same author before applying diversity penalty */
  MAX_CONSECUTIVE_SAME_AUTHOR: 3,
  
  /** Hours after which recency score starts decaying significantly */
  RECENCY_DECAY_HALF_LIFE_HOURS: 24,
  
  /** Percentage of explore feed that should be from non-followed users */
  EXPLORE_NON_FOLLOWED_RATIO: 0.8,
  
  /** Percentage of home feed that can be recommended (non-followed but high interest match) */
  HOME_FEED_RECOMMENDED_RATIO: 0.15,
} as const;

