"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RANKING_CONFIG = exports.SEARCH_WEIGHTS = exports.EXPLORE_WEIGHTS = exports.HOME_FEED_WEIGHTS = void 0;
exports.HOME_FEED_WEIGHTS = {
    relationship: 0.5,
    engagement: 0.2,
    personalization: 0.15,
    recency: 0.1,
    negativeFeedback: -1.0,
    authorDiversityPenalty: 0.05,
};
exports.EXPLORE_WEIGHTS = {
    relationship: 0.1,
    engagement: 0.35,
    personalization: 0.25,
    recency: 0.25,
    negativeFeedback: -1.0,
    authorDiversityPenalty: 0.05,
};
exports.SEARCH_WEIGHTS = {
    relationship: 0.2,
    engagement: 0.25,
    personalization: 0.2,
    recency: 0.15,
    negativeFeedback: -1.0,
    authorDiversityPenalty: 0.05,
};
exports.RANKING_CONFIG = {
    MAX_CANDIDATES: 400,
    MIN_CANDIDATES: 50,
    ENGAGEMENT_WINDOW_DAYS: 7,
    RELATIONSHIP_WINDOW_DAYS: 30,
    INTEREST_WINDOW_DAYS: 30,
    MAX_CONSECUTIVE_SAME_AUTHOR: 3,
    RECENCY_DECAY_HALF_LIFE_HOURS: 24,
    EXPLORE_NON_FOLLOWED_RATIO: 0.8,
    HOME_FEED_RECOMMENDED_RATIO: 0.15,
};
//# sourceMappingURL=ranking.js.map