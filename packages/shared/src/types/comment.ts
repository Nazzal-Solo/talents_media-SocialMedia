export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id?: string | null;
  text: string;
  created_at: string;
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
  user_reaction?: string;
  replies?: Comment[];
  replies_count?: number;
}

export interface CreateCommentData {
  post_id: string;
  text: string;
  parent_comment_id?: string | null;
}

