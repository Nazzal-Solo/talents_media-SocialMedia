export interface Comment {
    id: string;
    post_id: string;
    user_id: string;
    parent_comment_id?: string | null;
    text: string;
    created_at: Date;
    user?: {
        id: string;
        username: string;
        display_name: string;
        avatar_url?: string;
    };
    reactions?: Record<string, number>;
    user_reaction?: string;
    replies?: Comment[];
    replies_count?: number;
}
export interface Reaction {
    id: string;
    post_id?: string;
    comment_id?: string;
    user_id: string;
    kind: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';
    created_at: Date;
}
export declare class CommentsService {
    createComment(postId: string, userId: string, text: string, parentCommentId?: string | null): Promise<Comment>;
    getPostComments(postId: string, page?: number, limit?: number, userId?: string): Promise<Comment[]>;
    deleteComment(commentId: string, userId: string): Promise<boolean>;
}
export declare class ReactionsService {
    addReaction(userId: string, kind: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry', postId?: string, commentId?: string): Promise<Reaction>;
    removeReaction(userId: string, postId?: string, commentId?: string): Promise<boolean>;
    getReactions(postId?: string, commentId?: string): Promise<Record<string, number>>;
    getReactionUsers(postId: string, kind?: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry', limit?: number, offset?: number): Promise<Array<{
        user_id: string;
        username: string;
        display_name: string;
        avatar_url?: string;
        kind: string;
        created_at: Date;
    }>>;
}
//# sourceMappingURL=commentsReactionsService.d.ts.map