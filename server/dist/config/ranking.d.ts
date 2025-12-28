export interface RankingWeights {
    relationship: number;
    engagement: number;
    personalization: number;
    recency: number;
    negativeFeedback: number;
    authorDiversityPenalty: number;
}
export declare const HOME_FEED_WEIGHTS: RankingWeights;
export declare const EXPLORE_WEIGHTS: RankingWeights;
export declare const SEARCH_WEIGHTS: RankingWeights;
export declare const RANKING_CONFIG: {
    readonly MAX_CANDIDATES: 400;
    readonly MIN_CANDIDATES: 50;
    readonly ENGAGEMENT_WINDOW_DAYS: 7;
    readonly RELATIONSHIP_WINDOW_DAYS: 30;
    readonly INTEREST_WINDOW_DAYS: 30;
    readonly MAX_CONSECUTIVE_SAME_AUTHOR: 3;
    readonly RECENCY_DECAY_HALF_LIFE_HOURS: 24;
    readonly EXPLORE_NON_FOLLOWED_RATIO: 0.8;
    readonly HOME_FEED_RECOMMENDED_RATIO: 0.15;
};
//# sourceMappingURL=ranking.d.ts.map