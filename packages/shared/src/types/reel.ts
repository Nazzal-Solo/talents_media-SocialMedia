export interface Reel {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  duration_sec?: number;
  views_count: number;
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
  comments_count?: number;
  user_reaction?: string;
}

export interface CreateReelData {
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  duration_sec?: number;
}

