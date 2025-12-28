import { query } from '../models/db';
import { logger } from '../middlewares';

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

export class UsersService {
  async getUserProfile(
    username: string,
    currentUserId?: string
  ): Promise<UserProfile | null> {
    const result = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.website, u.location, 
              u.theme_pref, u.role, u.created_at, u.updated_at
       FROM users u
       WHERE u.username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0] as UserProfile;

    // Get followers count
    const followersResult = await query(
      'SELECT COUNT(*) as count FROM follows WHERE following_id = $1',
      [user.id]
    );
    user.followers_count = parseInt(followersResult.rows[0].count);

    // Get following count
    const followingResult = await query(
      'SELECT COUNT(*) as count FROM follows WHERE follower_id = $1',
      [user.id]
    );
    user.following_count = parseInt(followingResult.rows[0].count);

    // Get posts count
    const postsResult = await query(
      "SELECT COUNT(*) as count FROM posts WHERE user_id = $1 AND visibility = 'public'",
      [user.id]
    );
    user.posts_count = parseInt(postsResult.rows[0].count);

    // Check if current user is following this user
    if (currentUserId) {
      const followResult = await query(
        'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
        [currentUserId, user.id]
      );
      user.is_following = followResult.rows.length > 0;
    }

    return user;
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileData
  ): Promise<User | null> {
    const result = await query(
      `UPDATE users 
       SET display_name = COALESCE($1, display_name),
           bio = COALESCE($2, bio),
           website = COALESCE($3, website),
           location = COALESCE($4, location),
           theme_pref = COALESCE($5, theme_pref),
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, email, username, display_name, avatar_url, bio, website, location, theme_pref, role, created_at, updated_at`,
      [
        data.display_name,
        data.bio,
        data.website,
        data.location,
        data.theme_pref,
        userId,
      ]
    );

    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }

  async followUser(
    followerId: string,
    followingUsername: string
  ): Promise<boolean> {
    // Get following user ID
    const userResult = await query('SELECT id FROM users WHERE username = $1', [
      followingUsername,
    ]);

    if (userResult.rows.length === 0) {
      return false;
    }

    const followingId = userResult.rows[0].id;

    // Check if already following
    const existingFollow = await query(
      'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );

    if (existingFollow.rows.length > 0) {
      return false; // Already following
    }

    // Create follow relationship
    await query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
      [followerId, followingId]
    );

    logger.info(`User ${followerId} followed ${followingUsername}`);
    return true;
  }

  async unfollowUser(
    followerId: string,
    followingUsername: string
  ): Promise<boolean> {
    // Get following user ID
    const userResult = await query('SELECT id FROM users WHERE username = $1', [
      followingUsername,
    ]);

    if (userResult.rows.length === 0) {
      return false;
    }

    const followingId = userResult.rows[0].id;

    // Remove follow relationship
    const result = await query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2 RETURNING 1',
      [followerId, followingId]
    );

    if (result.rows.length > 0) {
      logger.info(`User ${followerId} unfollowed ${followingUsername}`);
      return true;
    }

    return false;
  }

  async getFollowers(
    username: string,
    page: number = 1,
    limit: number = 20
  ): Promise<FollowUser[]> {
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, f.created_at
       FROM follows f
       JOIN users u ON f.follower_id = u.id
       JOIN users target ON f.following_id = target.id
       WHERE target.username = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [username, limit, offset]
    );

    return result.rows as FollowUser[];
  }

  async getFollowing(
    username: string,
    page: number = 1,
    limit: number = 20
  ): Promise<FollowUser[]> {
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, f.created_at
       FROM follows f
       JOIN users u ON f.following_id = u.id
       JOIN users target ON f.follower_id = target.id
       WHERE target.username = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [username, limit, offset]
    );

    return result.rows as FollowUser[];
  }

  async getUserById(userId: string): Promise<User | null> {
    const result = await query(
      'SELECT id, email, username, display_name, avatar_url, bio, website, location, theme_pref, role, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    return result.rows.length > 0 ? (result.rows[0] as User) : null;
  }

  async searchUsers(
    searchQuery: string,
    limit: number = 20,
    excludeUserId?: string
  ): Promise<
    Array<{
      id: string;
      username: string;
      display_name: string;
      avatar_url?: string;
      bio?: string;
      followers_count: number;
      following_count: number;
      posts_count: number;
      is_following?: boolean;
    }>
  > {
    try {
      const searchPattern = `%${searchQuery.toLowerCase().trim()}%`;

      logger.info(`[SearchUsers] Searching for: "${searchQuery}", limit: ${limit}, excludeUserId: ${excludeUserId || 'none'}`);

      // Build query with optional exclusion of current user
      let queryText = `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio
         FROM users u
         WHERE (LOWER(u.username) LIKE $1 OR LOWER(u.display_name) LIKE $1)`;
      const queryParams: any[] = [searchPattern];

      if (excludeUserId) {
        queryText += ` AND u.id != $2`;
        queryParams.push(excludeUserId);
      }

      queryText += ` ORDER BY u.username LIMIT $${queryParams.length + 1}`;
      queryParams.push(limit);

      const result = await query(queryText, queryParams);

      if (result.rows.length === 0) {
        logger.info(`[SearchUsers] No users found for query: "${searchQuery}"`);
        return [];
      }

      const userIds = result.rows.map(row => row.id);

      // Bulk fetch followers count
      const followersResult = await query(
        `SELECT following_id, COUNT(*) as count
         FROM follows
         WHERE following_id = ANY($1::uuid[])
         GROUP BY following_id`,
        [userIds]
      );

      // Bulk fetch following count
      const followingResult = await query(
        `SELECT follower_id, COUNT(*) as count
         FROM follows
         WHERE follower_id = ANY($1::uuid[])
         GROUP BY follower_id`,
        [userIds]
      );

      // Bulk fetch posts count
      const postsResult = await query(
        `SELECT user_id, COUNT(*) as count
         FROM posts
         WHERE user_id = ANY($1::uuid[]) AND visibility = 'public'
         GROUP BY user_id`,
        [userIds]
      );

      // Create lookup maps
      const followersMap = new Map<string, number>();
      followersResult.rows.forEach(row => {
        followersMap.set(row.following_id, parseInt(row.count));
      });

      const followingMap = new Map<string, number>();
      followingResult.rows.forEach(row => {
        followingMap.set(row.follower_id, parseInt(row.count));
      });

      const postsMap = new Map<string, number>();
      postsResult.rows.forEach(row => {
        postsMap.set(row.user_id, parseInt(row.count));
      });

      const users = result.rows.map(row => ({
        id: row.id,
        username: row.username,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
        bio: row.bio,
        followers_count: followersMap.get(row.id) || 0,
        following_count: followingMap.get(row.id) || 0,
        posts_count: postsMap.get(row.id) || 0,
      }));

      logger.info(`[SearchUsers] Found ${users.length} users for query: "${searchQuery}"`);

      return users;
    } catch (error: any) {
      logger.error('[SearchUsers] Error searching users:', {
        error: error.message,
        stack: error.stack,
        searchQuery,
        limit,
      });
      throw error;
    }
  }

  async getAllUsers(
    limit: number = 20,
    offset: number = 0,
    excludeUserId?: string
  ): Promise<
    Array<{
      id: string;
      username: string;
      display_name: string;
      avatar_url?: string;
      bio?: string;
      followers_count: number;
      following_count: number;
      posts_count: number;
      is_following?: boolean;
    }>
  > {
    // Build query with optional exclusion of current user
    let queryText = `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio
       FROM users u`;
    const queryParams: any[] = [];

    if (excludeUserId) {
      queryText += ` WHERE u.id != $1`;
      queryParams.push(excludeUserId);
      queryText += ` ORDER BY u.created_at DESC LIMIT $2 OFFSET $3`;
      queryParams.push(limit, offset);
    } else {
      queryText += ` ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`;
      queryParams.push(limit, offset);
    }

    const result = await query(queryText, queryParams);

    const users = result.rows.map(async row => {
      // Get followers count
      const followersResult = await query(
        'SELECT COUNT(*) as count FROM follows WHERE following_id = $1',
        [row.id]
      );
      const followers_count = parseInt(followersResult.rows[0].count);

      // Get following count
      const followingResult = await query(
        'SELECT COUNT(*) as count FROM follows WHERE follower_id = $1',
        [row.id]
      );
      const following_count = parseInt(followingResult.rows[0].count);

      // Get posts count
      const postsResult = await query(
        "SELECT COUNT(*) as count FROM posts WHERE user_id = $1 AND visibility = 'public'",
        [row.id]
      );
      const posts_count = parseInt(postsResult.rows[0].count);

      return {
        id: row.id,
        username: row.username,
        display_name: row.display_name,
        avatar_url: row.avatar_url,
        bio: row.bio,
        followers_count,
        following_count,
        posts_count,
      };
    });

    return Promise.all(users);
  }
}
