export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  website?: string;
  location?: string;
  theme_pref: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile extends User {
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
  is_following?: boolean;
}

