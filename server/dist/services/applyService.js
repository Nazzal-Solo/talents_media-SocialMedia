"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplyService = void 0;
const db_1 = require("../models/db");
const middlewares_1 = require("../middlewares");
class ApplyService {
    async getProfile(userId) {
        try {
            const result = await (0, db_1.query)('SELECT * FROM apply_profiles WHERE user_id = $1', [userId]);
            if (!result.rows[0]) {
                return null;
            }
            const profile = result.rows[0];
            if (typeof profile.preferences === 'string') {
                profile.preferences = JSON.parse(profile.preferences);
            }
            const cvResult = await (0, db_1.query)('SELECT cloudinary_secure_url, file_name, file_size, uploaded_at FROM apply_cv_assets WHERE profile_id = $1', [profile.id]);
            if (cvResult.rows[0] && !profile.cv_url) {
                profile.cv_url = cvResult.rows[0].cloudinary_secure_url;
            }
            return profile;
        }
        catch (error) {
            middlewares_1.logger.error('Error getting profile:', error);
            return null;
        }
    }
    async createOrUpdateProfile(userId, data) {
        const existing = await this.getProfile(userId);
        if (existing) {
            const updateFields = [];
            const updateValues = [];
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
            const result = await (0, db_1.query)(`UPDATE apply_profiles SET ${updateFields.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`, updateValues);
            return result.rows[0];
        }
        else {
            const result = await (0, db_1.query)(`INSERT INTO apply_profiles (
          user_id, skills, job_titles, locations, salary_min, salary_max, salary_currency,
          include_keywords, exclude_keywords, cv_url, portfolio_urls, preferences, auto_apply_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`, [
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
            ]);
            return result.rows[0];
        }
    }
    async getPlans() {
        try {
            const result = await (0, db_1.query)('SELECT * FROM apply_plans WHERE is_active = TRUE ORDER BY price_monthly ASC');
            return result.rows.map((plan) => {
                if (typeof plan.features === 'string') {
                    plan.features = JSON.parse(plan.features);
                }
                return plan;
            });
        }
        catch (error) {
            middlewares_1.logger.error('Error getting plans:', error);
            return [];
        }
    }
    async getPlanByName(name) {
        try {
            const result = await (0, db_1.query)('SELECT * FROM apply_plans WHERE name = $1', [name]);
            if (!result.rows[0]) {
                return null;
            }
            const plan = result.rows[0];
            if (typeof plan.features === 'string') {
                plan.features = JSON.parse(plan.features);
            }
            return plan;
        }
        catch (error) {
            middlewares_1.logger.error('Error getting plan by name:', error);
            return null;
        }
    }
    async getUserPlan(userId) {
        try {
            const result = await (0, db_1.query)(`SELECT up.*, p.name as plan_name, p.display_name, p.daily_apply_limit, p.price_monthly
         FROM apply_user_plans up
         JOIN apply_plans p ON up.plan_id = p.id
         WHERE up.user_id = $1 AND up.status = 'active'
         ORDER BY up.started_at DESC
         LIMIT 1`, [userId]);
            return result.rows[0] || null;
        }
        catch (error) {
            middlewares_1.logger.error('Error getting user plan:', error);
            return null;
        }
    }
    async setUserPlan(userId, planId) {
        await (0, db_1.query)(`UPDATE apply_user_plans SET status = 'cancelled' WHERE user_id = $1 AND status = 'active'`, [userId]);
        const result = await (0, db_1.query)(`INSERT INTO apply_user_plans (user_id, plan_id, status)
       VALUES ($1, $2, 'active') RETURNING *`, [userId, planId]);
        return result.rows[0];
    }
    async getJobs(filters) {
        let queryStr = 'SELECT * FROM apply_jobs WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        if (filters?.source) {
            queryStr += ` AND source = $${paramIndex}`;
            params.push(filters.source);
            paramIndex++;
        }
        const countResult = await (0, db_1.query)(queryStr.replace('SELECT *', 'SELECT COUNT(*) as total'));
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
        const result = await (0, db_1.query)(queryStr, params);
        return { jobs: result.rows, total };
    }
    async getJobById(jobId) {
        const result = await (0, db_1.query)('SELECT * FROM apply_jobs WHERE id = $1', [jobId]);
        return result.rows[0] || null;
    }
    async createJob(job) {
        const result = await (0, db_1.query)(`INSERT INTO apply_jobs (
        external_id, source, title, company, location, description,
        salary_min, salary_max, salary_currency, job_url, application_url,
        application_method, posted_date, expires_date, raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`, [
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
            job.posted_date || null,
            job.expires_date || null,
            job.raw_data ? JSON.stringify(job.raw_data) : null,
        ]);
        return result.rows[0];
    }
    async getApplications(userId, filters) {
        try {
            let queryStr = `
        SELECT a.*, j.title as job_title, j.company, j.location as job_location, j.job_url
        FROM apply_applications a
        LEFT JOIN apply_jobs j ON a.job_id = j.id
        WHERE a.user_id = $1
      `;
            const params = [userId];
            let paramIndex = 2;
            if (filters?.status) {
                queryStr += ` AND a.status = $${paramIndex}`;
                params.push(filters.status);
                paramIndex++;
            }
            const countResult = await (0, db_1.query)(`SELECT COUNT(*) as total FROM apply_applications WHERE user_id = $1${filters?.status ? ` AND status = $2` : ''}`, filters?.status ? [userId, filters.status] : [userId]);
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
            const result = await (0, db_1.query)(queryStr, params);
            const applications = result.rows.map((app) => {
                if (typeof app.application_details === 'string') {
                    app.application_details = JSON.parse(app.application_details);
                }
                return app;
            });
            return { applications, total };
        }
        catch (error) {
            middlewares_1.logger.error('Error getting applications:', error);
            return { applications: [], total: 0 };
        }
    }
    async createApplication(userId, jobId, data) {
        const result = await (0, db_1.query)(`INSERT INTO apply_applications (
        user_id, job_id, status, match_score, match_reason,
        application_method, application_details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, job_id) DO UPDATE SET
        status = EXCLUDED.status,
        match_score = EXCLUDED.match_score,
        match_reason = EXCLUDED.match_reason,
        application_method = EXCLUDED.application_method,
        application_details = EXCLUDED.application_details
      RETURNING *`, [
            userId,
            jobId,
            data.status || 'applied',
            data.match_score || null,
            data.match_reason || null,
            data.application_method || null,
            data.application_details ? JSON.stringify(data.application_details) : null,
        ]);
        return result.rows[0];
    }
    async getActivityLogs(userId, limit = 50, offset = 0) {
        try {
            const countResult = await (0, db_1.query)('SELECT COUNT(*) as total FROM apply_activity_logs WHERE user_id = $1', [userId]);
            const total = parseInt(countResult.rows[0]?.total || '0');
            const result = await (0, db_1.query)(`SELECT * FROM apply_activity_logs
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`, [userId, limit, offset]);
            const logs = result.rows.map((log) => {
                if (typeof log.details === 'string') {
                    log.details = JSON.parse(log.details);
                }
                return log;
            });
            return { logs, total };
        }
        catch (error) {
            middlewares_1.logger.error('Error getting activity logs:', error);
            return { logs: [], total: 0 };
        }
    }
    async createActivityLog(userId, action, details) {
        const result = await (0, db_1.query)(`INSERT INTO apply_activity_logs (user_id, job_id, application_id, action, details)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`, [
            userId,
            details?.job_id || null,
            details?.application_id || null,
            action,
            details ? JSON.stringify(details) : null,
        ]);
        return result.rows[0];
    }
    async getDailyQuota(userId, date) {
        const dateStr = date.toISOString().split('T')[0];
        const result = await (0, db_1.query)('SELECT applied_count FROM apply_daily_quotas WHERE user_id = $1 AND date = $2', [userId, dateStr]);
        return result.rows[0]?.applied_count || 0;
    }
    async incrementDailyQuota(userId, date) {
        const dateStr = date.toISOString().split('T')[0];
        await (0, db_1.query)(`INSERT INTO apply_daily_quotas (user_id, date, applied_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, date) DO UPDATE SET
         applied_count = apply_daily_quotas.applied_count + 1,
         updated_at = NOW()`, [userId, dateStr]);
    }
    async getDailyLimit(userId) {
        try {
            const userPlan = await this.getUserPlan(userId);
            if (!userPlan) {
                const freePlan = await this.getPlanByName('free');
                return freePlan?.daily_apply_limit || 2;
            }
            return userPlan.daily_apply_limit || 2;
        }
        catch (error) {
            middlewares_1.logger.error('Error getting daily limit:', error);
            return 2;
        }
    }
}
exports.ApplyService = ApplyService;
//# sourceMappingURL=applyService.js.map