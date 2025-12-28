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
export declare class ReelsService {
    createReel(userId: string, data: CreateReelData): Promise<Reel>;
    getReels(page?: number, limit?: number): Promise<Reel[]>;
    getReelById(reelId: string, userId?: string): Promise<Reel | null>;
    updateReel(reelId: string, userId: string, data: UpdateReelData): Promise<Reel | null>;
    deleteReel(reelId: string, userId: string): Promise<boolean>;
    incrementViews(reelId: string, userId?: string, ip?: string): Promise<void>;
    getUserReels(username: string, page?: number, limit?: number): Promise<Reel[]>;
}
//# sourceMappingURL=reelsService.d.ts.map