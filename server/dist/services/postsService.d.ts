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
export declare class PostsService {
    private rankingService;
    createPost(userId: string, data: CreatePostData): Promise<Post>;
    getPostById(postId: string, userId?: string): Promise<Post | null>;
    getFeed(userId: string, page?: number, limit?: number): Promise<Post[]>;
    getExplore(userId: string | undefined, page?: number, limit?: number): Promise<Post[]>;
    updatePost(postId: string, userId: string, data: UpdatePostData): Promise<Post | null>;
    deletePost(postId: string, userId: string): Promise<boolean>;
    getUserPosts(username: string, page?: number, limit?: number): Promise<Post[]>;
    getTrendingHashtags(limit?: number): Promise<Array<{
        tag: string;
        posts: number;
    }>>;
    hidePost(userId: string, postId: string): Promise<boolean>;
    reportPost(userId: string, postId: string, reason?: string, description?: string): Promise<boolean>;
    markNotInterested(userId: string, postId: string): Promise<boolean>;
    getHiddenPostIds(userId: string): Promise<string[]>;
    getNotInterestedPostIds(userId: string): Promise<string[]>;
    searchPosts(searchQueryParam: string, userId?: string, limit?: number, mediaType?: 'image' | 'video'): Promise<Post[]>;
}
//# sourceMappingURL=postsService.d.ts.map