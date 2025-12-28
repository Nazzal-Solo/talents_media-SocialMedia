export type ReactionType = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';

export interface Reaction {
  id: string;
  post_id?: string;
  comment_id?: string;
  user_id: string;
  reaction_type: ReactionType;
  created_at: string;
}

export interface ReactionCounts {
  like: number;
  love: number;
  laugh: number;
  wow: number;
  sad: number;
  angry: number;
}

