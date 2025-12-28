import { RankingWeights } from '../config/ranking';
import { Post } from './postsService';
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
export interface PaginationParams {
    page: number;
    limit: number;
}
interface UserInterestProfile {
    [hashtag: string]: number;
}
export declare class FeedRankingService {
    private extractHashtags;
    computeRelationshipScore(viewerId: string, authorId: string): Promise<number>;
    getUserInterestProfile(userId: string): Promise<UserInterestProfile>;
    computePersonalizationScore(post: Post, userInterestProfile: UserInterestProfile): Promise<number>;
    computeEngagementScore(postId: string, postCreatedAt: Date): Promise<number>;
    computeRecencyScore(postCreatedAt: Date): number;
    computeNegativeFeedbackScore(userId: string, postId: string): Promise<number>;
    applyAuthorDiversity(rankedPosts: RankedPost[], maxConsecutive?: number): RankedPost[];
    generateHomeFeedCandidates(userId: string, limit?: number): Promise<Post[]>;
    generateExploreCandidates(userId: string, limit?: number): Promise<Post[]>;
    rankPosts(posts: Post[], userId: string, weights: RankingWeights, includeDebug?: boolean): Promise<RankedPost[]>;
    getRankedHomeFeed(userId: string, pagination: PaginationParams): Promise<{
        posts: Post[];
        page: number;
        limit: number;
    }>;
    getRankedExploreFeed(userId: string, pagination: PaginationParams): Promise<{
        posts: Post[];
        page: number;
        limit: number;
    }>;
    rankSearchResults(rawResults: Post[], userId: string | undefined, searchQuery: string): Promise<Post[]>;
}
export {};
//# sourceMappingURL=feedRankingService.d.ts.map