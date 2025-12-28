import { query } from '../models/db';
import { logger } from '../middlewares';
import { generateFallbackFilename } from '../utils/filenameUtils';

export interface ApplyProfile {
  id: string;
  user_id: string;
  skills: string[];
  job_titles: string[];
  locations: string[];
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  include_keywords: string[];
  exclude_keywords: string[];
  cv_url?: string;
  portfolio_urls: string[];
  preferences: Record<string, any>;
  auto_apply_enabled: boolean;
  preferred_run_time?: string; // Time in HH:MM format (e.g., "09:00")
  created_at: string;
  updated_at: string;
}

export interface ApplyJob {
  id: string;
  external_id?: string;
  source: string;
  title: string;
  company?: string;
  location?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  job_url: string;
  application_url?: string;
  application_method: string;
  apply_email?: string;
  is_remote?: boolean;
  job_hash?: string;
  posted_date?: string;
  expires_date?: string;
  raw_data?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ApplyApplication {
  id: string;
  user_id: string;
  job_id: string;
  status: 'applied' | 'failed' | 'skipped' | 'pending';
  match_score?: number;
  match_reason?: string;
  application_method?: string;
  application_details?: Record<string, any>;
  applied_at: string;
  created_at: string;
}

export interface ApplyPlan {
  id: string;
  name: string;
  display_name: string;
  daily_apply_limit: number;
  price_monthly: number;
  features: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

export interface UserPlan {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'expired';
  started_at: string;
  expires_at?: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  job_id?: string;
  application_id?: string;
  action: string;
  details?: Record<string, any>;
  created_at: string;
}

export class ApplyService {
  // Profile methods
  async getProfile(userId: string): Promise<ApplyProfile | null> {
    try {
      const result = await query(
        'SELECT * FROM apply_profiles WHERE user_id = $1',
        [userId]
      );
      if (!result.rows[0]) {
        return null;
      }
      const profile = result.rows[0];
      
      // Parse JSONB fields if they're strings
      if (typeof profile.preferences === 'string') {
        profile.preferences = JSON.parse(profile.preferences);
      }
      
      // Get CV asset info if exists
      const cvResult = await query(
        `SELECT cloudinary_secure_url, file_name, file_size, mime_type, uploaded_at 
         FROM apply_cv_assets WHERE profile_id = $1`,
        [profile.id]
      );
      
      if (cvResult.rows[0]) {
        const cvAsset = cvResult.rows[0];
        
        // Set cv_url for backward compatibility
        if (!profile.cv_url) {
          profile.cv_url = cvAsset.cloudinary_secure_url;
        }
        
        // Attach CV metadata to profile
        // Use stored filename or generate fallback from mime type for backward compatibility
        (profile as any).cv = {
          url: cvAsset.cloudinary_secure_url,
          file_name: cvAsset.file_name || generateFallbackFilename(cvAsset.mime_type),
          file_size: cvAsset.file_size,
          mime_type: cvAsset.mime_type,
          uploaded_at: cvAsset.uploaded_at,
        };
      }
      
      return profile;
    } catch (error) {
      logger.error('Error getting profile:', error);
      return null;
    }
  }

  async createOrUpdateProfile(
    userId: string,
    data: Partial<ApplyProfile>
  ): Promise<ApplyProfile> {
    const existing = await this.getProfile(userId);

    if (existing) {
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'user_id' && key !== 'created_at') {
          updateFields.push(`${key} = $${paramIndex}`);
          updateValues.push(value);
          paramIndex++;
        }
      });

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(userId);

      const result = await query(
        `UPDATE apply_profiles SET ${updateFields.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
        updateValues
      );

      return result.rows[0];
    } else {
      const result = await query(
        `INSERT INTO apply_profiles (
          user_id, skills, job_titles, locations, salary_min, salary_max, salary_currency,
          include_keywords, exclude_keywords, cv_url, portfolio_urls, preferences, auto_apply_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
        [
          userId,
          data.skills || [],
          data.job_titles || [],
          data.locations || [],
          data.salary_min || null,
          data.salary_max || null,
          data.salary_currency || 'USD',
          data.include_keywords || [],
          data.exclude_keywords || [],
          data.cv_url || null,
          data.portfolio_urls || [],
          JSON.stringify(data.preferences || {}),
          data.auto_apply_enabled || false,
        ]
      );

      return result.rows[0];
    }
  }

  // Plan methods
  async getPlans(): Promise<ApplyPlan[]> {
    try {
      const result = await query(
        'SELECT * FROM apply_plans WHERE is_active = TRUE ORDER BY price_monthly ASC'
      );
      // Parse JSONB fields
      return result.rows.map((plan: any) => {
        if (typeof plan.features === 'string') {
          plan.features = JSON.parse(plan.features);
        }
        return plan;
      });
    } catch (error) {
      logger.error('Error getting plans:', error);
      return [];
    }
  }

  async getPlanByName(name: string): Promise<ApplyPlan | null> {
    try {
      const result = await query('SELECT * FROM apply_plans WHERE name = $1', [name]);
      if (!result.rows[0]) {
        return null;
      }
      const plan = result.rows[0];
      // Parse JSONB fields
      if (typeof plan.features === 'string') {
        plan.features = JSON.parse(plan.features);
      }
      return plan;
    } catch (error) {
      logger.error('Error getting plan by name:', error);
      return null;
    }
  }

  async getUserPlan(userId: string): Promise<UserPlan | null> {
    try {
      const result = await query(
        `SELECT up.*, p.name as plan_name, p.display_name, p.daily_apply_limit, p.price_monthly
         FROM apply_user_plans up
         JOIN apply_plans p ON up.plan_id = p.id
         WHERE up.user_id = $1 AND up.status = 'active'
         ORDER BY up.started_at DESC
         LIMIT 1`,
        [userId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting user plan:', error);
      return null;
    }
  }

  async setUserPlan(
    userId: string,
    planId: string
  ): Promise<UserPlan> {
    // Use INSERT ... ON CONFLICT to handle the UNIQUE constraint on user_id
    // This will update existing plan or create new one
    const result = await query(
      `INSERT INTO apply_user_plans (user_id, plan_id, status, started_at)
       VALUES ($1, $2, 'active', NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         plan_id = EXCLUDED.plan_id,
         status = EXCLUDED.status,
         started_at = EXCLUDED.started_at,
         expires_at = NULL
       RETURNING *`,
      [userId, planId]
    );

    return result.rows[0];
  }

  // Job methods
  async getJobs(
    filters?: {
      source?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ jobs: ApplyJob[]; total: number }> {
    let queryStr = 'SELECT * FROM apply_jobs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.source) {
      queryStr += ` AND source = $${paramIndex}`;
      params.push(filters.source);
      paramIndex++;
    }

    const countResult = await query(
      queryStr.replace('SELECT *', 'SELECT COUNT(*) as total')
    );
    const total = parseInt(countResult.rows[0].total);

    queryStr += ' ORDER BY posted_date DESC NULLS LAST, created_at DESC';
    
    if (filters?.limit) {
      queryStr += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }
    if (filters?.offset) {
      queryStr += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
      paramIndex++;
    }

    const result = await query(queryStr, params);
    return { jobs: result.rows, total };
  }

  async getJobById(jobId: string): Promise<ApplyJob | null> {
    const result = await query('SELECT * FROM apply_jobs WHERE id = $1', [jobId]);
    return result.rows[0] || null;
  }

  async createJob(job: Partial<ApplyJob>): Promise<ApplyJob> {
    const result = await query(
      `INSERT INTO apply_jobs (
        external_id, source, title, company, location, description,
        salary_min, salary_max, salary_currency, job_url, application_url,
        application_method, apply_email, is_remote, job_hash, posted_date, expires_date, raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        job.external_id || null,
        job.source,
        job.title,
        job.company || null,
        job.location || null,
        job.description || null,
        job.salary_min || null,
        job.salary_max || null,
        job.salary_currency || null,
        job.job_url,
        job.application_url || null,
        job.application_method || 'email',
        job.apply_email || null,
        job.is_remote || false,
        job.job_hash || null,
        job.posted_date || null,
        job.expires_date || null,
        job.raw_data ? JSON.stringify(job.raw_data) : null,
      ]
    );
    return result.rows[0];
  }

  // Application methods
  async getApplications(
    userId: string,
    filters?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ applications: ApplyApplication[]; total: number }> {
    try {
      let queryStr = `
        SELECT a.*, j.title as job_title, j.company, j.location as job_location, j.job_url
        FROM apply_applications a
        LEFT JOIN apply_jobs j ON a.job_id = j.id
        WHERE a.user_id = $1
      `;
      const params: any[] = [userId];
      let paramIndex = 2;

      if (filters?.status) {
        queryStr += ` AND a.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      const countResult = await query(
        `SELECT COUNT(*) as total FROM apply_applications WHERE user_id = $1${filters?.status ? ` AND status = $2` : ''}`,
        filters?.status ? [userId, filters.status] : [userId]
      );
      const total = parseInt(countResult.rows[0]?.total || '0');

      queryStr += ' ORDER BY a.applied_at DESC';
      
      if (filters?.limit) {
        queryStr += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
        paramIndex++;
      }
      if (filters?.offset) {
        queryStr += ` OFFSET $${paramIndex}`;
        params.push(filters.offset);
        paramIndex++;
      }

      const result = await query(queryStr, params);
      
      // Parse JSONB fields
      const applications = result.rows.map((app: any) => {
        if (typeof app.application_details === 'string') {
          app.application_details = JSON.parse(app.application_details);
        }
        return app;
      });
      
      return { applications, total };
    } catch (error) {
      logger.error('Error getting applications:', error);
      return { applications: [], total: 0 };
    }
  }

  async createApplication(
    userId: string,
    jobId: string,
    data: {
      status?: string;
      match_score?: number;
      match_reason?: string;
      application_method?: string;
      application_details?: Record<string, any>;
    }
  ): Promise<ApplyApplication> {
    const result = await query(
      `INSERT INTO apply_applications (
        user_id, job_id, status, match_score, match_reason,
        application_method, application_details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, job_id) DO UPDATE SET
        status = EXCLUDED.status,
        match_score = EXCLUDED.match_score,
        match_reason = EXCLUDED.match_reason,
        application_method = EXCLUDED.application_method,
        application_details = EXCLUDED.application_details
      RETURNING *`,
      [
        userId,
        jobId,
        data.status || 'applied',
        data.match_score || null,
        data.match_reason || null,
        data.application_method || null,
        data.application_details ? JSON.stringify(data.application_details) : null,
      ]
    );
    return result.rows[0];
  }

  // Activity log methods
  async getActivityLogs(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ logs: ActivityLog[]; total: number }> {
    try {
      const countResult = await query(
        'SELECT COUNT(*) as total FROM apply_activity_logs WHERE user_id = $1',
        [userId]
      );
      const total = parseInt(countResult.rows[0]?.total || '0');

      const result = await query(
        `SELECT * FROM apply_activity_logs
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      // Parse JSONB fields
      const logs = result.rows.map((log: any) => {
        if (typeof log.details === 'string') {
          log.details = JSON.parse(log.details);
        }
        return log;
      });

      return { logs, total };
    } catch (error) {
      logger.error('Error getting activity logs:', error);
      return { logs: [], total: 0 };
    }
  }

  async createActivityLog(
    userId: string,
    action: string,
    details?: {
      job_id?: string;
      application_id?: string;
      [key: string]: any;
    }
  ): Promise<ActivityLog> {
    const result = await query(
      `INSERT INTO apply_activity_logs (user_id, job_id, application_id, action, details)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        userId,
        details?.job_id || null,
        details?.application_id || null,
        action,
        details ? JSON.stringify(details) : null,
      ]
    );
    return result.rows[0];
  }

  // Daily quota methods
  async getDailyQuota(userId: string, date: Date): Promise<number> {
    const dateStr = date.toISOString().split('T')[0];
    const result = await query(
      'SELECT applied_count FROM apply_daily_quotas WHERE user_id = $1 AND date = $2',
      [userId, dateStr]
    );
    return result.rows[0]?.applied_count || 0;
  }

  async incrementDailyQuota(userId: string, date: Date): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    await query(
      `INSERT INTO apply_daily_quotas (user_id, date, applied_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, date) DO UPDATE SET
         applied_count = apply_daily_quotas.applied_count + 1,
         updated_at = NOW()`,
      [userId, dateStr]
    );
  }

  async getDailyLimit(userId: string): Promise<number> {
    try {
      const userPlan = await this.getUserPlan(userId);
      if (!userPlan) {
        // Default to free plan limit
        const freePlan = await this.getPlanByName('free');
        return freePlan?.daily_apply_limit || 2;
      }
      // getUserPlan returns extra fields from JOIN, so we can access daily_apply_limit
      return (userPlan as any).daily_apply_limit || 2;
    } catch (error) {
      logger.error('Error getting daily limit:', error);
      // Default to free plan limit on error
      return 2;
    }
  }

  // Job matching methods
  async createJobMatch(
    userId: string,
    jobId: string,
    matchScore: number,
    matchReasons: string[],
    status: 'queued' | 'skipped' | 'applied' | 'failed' | 'assisted_required' = 'queued'
  ): Promise<any> {
    const result = await query(
      `INSERT INTO job_matches (user_id, job_id, match_score, match_reasons, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, job_id) DO UPDATE SET
         match_score = EXCLUDED.match_score,
         match_reasons = EXCLUDED.match_reasons,
         status = EXCLUDED.status,
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        jobId,
        matchScore,
        JSON.stringify(matchReasons),
        status,
      ]
    );
    return result.rows[0];
  }

  async getJobMatches(
    userId: string,
    filters?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ matches: any[]; total: number }> {
    try {
      let queryStr = `
        SELECT m.*, j.title as job_title, j.company, j.location as job_location, 
               j.job_url, j.application_url as apply_url, j.apply_email, j.is_remote, j.application_method
        FROM job_matches m
        JOIN apply_jobs j ON m.job_id = j.id
        WHERE m.user_id = $1
      `;
      const params: any[] = [userId];
      let paramIndex = 2;

      if (filters?.status) {
        queryStr += ` AND m.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      const countResult = await query(
        `SELECT COUNT(*) as total FROM job_matches WHERE user_id = $1${filters?.status ? ` AND status = $2` : ''}`,
        filters?.status ? [userId, filters.status] : [userId]
      );
      const total = parseInt(countResult.rows[0]?.total || '0');

      queryStr += ' ORDER BY m.match_score DESC, m.created_at DESC';

      if (filters?.limit) {
        queryStr += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
        paramIndex++;
      }
      if (filters?.offset) {
        queryStr += ` OFFSET $${paramIndex}`;
        params.push(filters.offset);
        paramIndex++;
      }

      const result = await query(queryStr, params);

      // Parse JSONB fields
      const matches = result.rows.map((match: any) => {
        if (typeof match.match_reasons === 'string') {
          match.match_reasons = JSON.parse(match.match_reasons);
        }
      return match;
    });

    return { matches, total };
    } catch (error: any) {
      logger.error('Error getting job matches:', error);
      logger.error('Error details:', {
        message: error.message,
        stack: error.stack,
        userId,
        filters
      });
      return { matches: [], total: 0 };
    }
  }

  // Job deduplication
  async findJobByHash(jobHash: string): Promise<ApplyJob | null> {
    const result = await query('SELECT * FROM apply_jobs WHERE job_hash = $1', [jobHash]);
    return result.rows[0] || null;
  }

  async findJobByExternalId(source: string, externalId: string): Promise<ApplyJob | null> {
    const result = await query(
      'SELECT * FROM apply_jobs WHERE source = $1 AND external_id = $2',
      [source, externalId]
    );
    return result.rows[0] || null;
  }

  // Update job with new fields
  async updateJob(jobId: string, updates: Partial<ApplyJob>): Promise<ApplyJob> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at') {
        updateFields.push(`${key} = $${paramIndex}`);
        updateValues.push(value);
        paramIndex++;
      }
    });

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(jobId);

    const result = await query(
      `UPDATE apply_jobs SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      updateValues
    );

    return result.rows[0];
  }
}

