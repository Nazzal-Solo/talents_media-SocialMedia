export interface Post {
  id: string;
  user_id: string;
  text?: string;
  media_url?: string;
  media_type: 'image' | 'video' | 'none';
  visibility: 'public' | 'followers' | 'private';
  feeling?: string;
  location?: string;
  created_at: string;
  updated_at: string;
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
  visibility?: 'public' | 'followers' | 'private';
  feeling?: string;
  location?: string;
}

