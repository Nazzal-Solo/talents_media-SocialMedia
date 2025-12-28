import { create } from 'zustand';

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

interface FeedState {
  posts: Post[];
  reels: Reel[];
  isLoading: boolean;
  hasMore: boolean;
  page: number;
  setPosts: (posts: Post[]) => void;
  addPost: (post: Post) => void;
  updatePost: (postId: string, updates: Partial<Post>) => void;
  removePost: (postId: string) => void;
  setReels: (reels: Reel[]) => void;
  addReel: (reel: Reel) => void;
  updateReel: (reelId: string, updates: Partial<Reel>) => void;
  removeReel: (reelId: string) => void;
  setLoading: (loading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  setPage: (page: number) => void;
  incrementPage: () => void;
  reset: () => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
  posts: [],
  reels: [],
  isLoading: false,
  hasMore: true,
  page: 1,

  setPosts: (posts: Post[]) => {
    set({ posts });
  },

  addPost: (post: Post) => {
    set(state => ({
      posts: [post, ...state.posts],
    }));
  },

  updatePost: (postId: string, updates: Partial<Post>) => {
    set(state => ({
      posts: state.posts.map(post =>
        post.id === postId ? { ...post, ...updates } : post
      ),
    }));
  },

  removePost: (postId: string) => {
    set(state => ({
      posts: state.posts.filter(post => post.id !== postId),
    }));
  },

  setReels: (reels: Reel[]) => {
    set({ reels });
  },

  addReel: (reel: Reel) => {
    set(state => ({
      reels: [reel, ...state.reels],
    }));
  },

  updateReel: (reelId: string, updates: Partial<Reel>) => {
    set(state => ({
      reels: state.reels.map(reel =>
        reel.id === reelId ? { ...reel, ...updates } : reel
      ),
    }));
  },

  removeReel: (reelId: string) => {
    set(state => ({
      reels: state.reels.filter(reel => reel.id !== reelId),
    }));
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setHasMore: (hasMore: boolean) => {
    set({ hasMore });
  },

  setPage: (page: number) => {
    set({ page });
  },

  incrementPage: () => {
    set(state => ({ page: state.page + 1 }));
  },

  reset: () => {
    set({
      posts: [],
      reels: [],
      isLoading: false,
      hasMore: true,
      page: 1,
    });
  },
}));

