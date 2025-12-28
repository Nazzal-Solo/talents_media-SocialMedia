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
    created_at: Date;
    updated_at: Date;
}
export interface UserProfile extends Omit<User, 'email'> {
    followers_count: number;
    following_count: number;
    posts_count: number;
    is_following?: boolean;
}
export interface UpdateProfileData {
    display_name?: string;
    bio?: string;
    website?: string;
    location?: string;
    theme_pref?: string;
}
export interface FollowUser {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    bio?: string;
    created_at: Date;
}
export declare class UsersService {
    getUserProfile(username: string, currentUserId?: string): Promise<UserProfile | null>;
    updateProfile(userId: string, data: UpdateProfileData): Promise<User | null>;
    followUser(followerId: string, followingUsername: string): Promise<boolean>;
    unfollowUser(followerId: string, followingUsername: string): Promise<boolean>;
    getFollowers(username: string, page?: number, limit?: number): Promise<FollowUser[]>;
    getFollowing(username: string, page?: number, limit?: number): Promise<FollowUser[]>;
    getUserById(userId: string): Promise<User | null>;
    searchUsers(searchQuery: string, limit?: number, excludeUserId?: string): Promise<Array<{
        id: string;
        username: string;
        display_name: string;
        avatar_url?: string;
        bio?: string;
        followers_count: number;
        following_count: number;
        posts_count: number;
        is_following?: boolean;
    }>>;
    getAllUsers(limit?: number, offset?: number, excludeUserId?: string): Promise<Array<{
        id: string;
        username: string;
        display_name: string;
        avatar_url?: string;
        bio?: string;
        followers_count: number;
        following_count: number;
        posts_count: number;
        is_following?: boolean;
    }>>;
}
//# sourceMappingURL=usersService.d.ts.map