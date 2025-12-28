"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationService = void 0;
const db_1 = require("../models/db");
const middlewares_1 = require("../middlewares");
class AutomationService {
    constructor(applyService, jobMatchingService) {
        this.applyService = applyService;
        this.jobMatchingService = jobMatchingService;
    }
    async runAutoApply(userId) {
        try {
            middlewares_1.logger.info(`Starting auto-apply for user: ${userId}`);
            const profile = await this.applyService.getProfile(userId);
            if (!profile) {
                middlewares_1.logger.warn(`No profile found for user: ${userId}`);
                await this.applyService.createActivityLog(userId, 'auto_apply_skipped', {
                    reason: 'No profile configured',
                });
                return;
            }
            if (!profile.auto_apply_enabled) {
                middlewares_1.logger.info(`Auto-apply disabled for user: ${userId}`);
                return;
            }
            const userPlan = await this.applyService.getUserPlan(userId);
            if (!userPlan) {
                middlewares_1.logger.warn(`No active plan for user: ${userId}`);
                await this.applyService.createActivityLog(userId, 'auto_apply_skipped', {
                    reason: 'No active plan',
                });
                return;
            }
            const dailyLimit = await this.applyService.getDailyLimit(userId);
            const today = new Date();
            const appliedToday = await this.applyService.getDailyQuota(userId, today);
            if (appliedToday >= dailyLimit) {
                middlewares_1.logger.info(`Daily limit reached for user: ${userId} (${appliedToday}/${dailyLimit})`);
                await this.applyService.createActivityLog(userId, 'auto_apply_limit_reached', {
                    applied: appliedToday,
                    limit: dailyLimit,
                });
                return;
            }
            const remaining = dailyLimit - appliedToday;
            middlewares_1.logger.info(`Finding jobs for user: ${userId}`);
            const availableJobs = await this.jobMatchingService.findJobs(100);
            if (availableJobs.length === 0) {
                middlewares_1.logger.info(`No jobs available for user: ${userId}`);
                await this.applyService.createActivityLog(userId, 'auto_apply_no_jobs', {});
                return;
            }
            const applications = await this.applyService.getApplications(userId);
            const appliedJobIds = new Set(applications.applications.map(a => a.job_id));
            const newJobs = availableJobs.filter(job => !appliedJobIds.has(job.id));
            middlewares_1.logger.info(`Matching ${newJobs.length} jobs for user: ${userId}`);
            const matches = await this.jobMatchingService.matchJobs(profile, newJobs);
            const goodMatches = matches.filter(m => m.score >= 30);
            const jobsToApply = goodMatches
                .slice(0, remaining)
                .map(m => m.job);
            middlewares_1.logger.info(`Found ${jobsToApply.length} jobs to apply for user: ${userId}`);
            let appliedCount = 0;
            let failedCount = 0;
            for (const job of jobsToApply) {
                try {
                    const match = matches.find(m => m.job.id === job.id);
                    const matchScore = match?.score || 0;
                    const matchReason = match?.reasons.join('; ') || 'Matched';
                    await this.applyToJob(userId, job, matchScore, matchReason);
                    await this.applyService.incrementDailyQuota(userId, today);
                    appliedCount++;
                    middlewares_1.logger.info(`Applied to job ${job.id} for user: ${userId}`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                catch (error) {
                    failedCount++;
                    middlewares_1.logger.error(`Failed to apply to job ${job.id} for user ${userId}:`, error);
                    const match = matches.find(m => m.job.id === job.id);
                    await this.applyService.createApplication(userId, job.id, {
                        status: 'failed',
                        match_score: match?.score,
                        match_reason: match?.reasons.join('; '),
                        application_details: { error: String(error) },
                    });
                    await this.applyService.createActivityLog(userId, 'application_failed', {
                        job_id: job.id,
                        error: String(error),
                    });
                }
            }
            await this.applyService.createActivityLog(userId, 'auto_apply_completed', {
                applied: appliedCount,
                failed: failedCount,
                total_matched: goodMatches.length,
            });
            middlewares_1.logger.info(`Auto-apply completed for user: ${userId} - Applied: ${appliedCount}, Failed: ${failedCount}`);
        }
        catch (error) {
            middlewares_1.logger.error(`Auto-apply error for user ${userId}:`, error);
            await this.applyService.createActivityLog(userId, 'auto_apply_error', {
                error: String(error),
            });
        }
    }
    async applyToJob(userId, job, matchScore, matchReason) {
        const applicationMethod = job.application_method || 'email';
        const applicationUrl = job.application_url || job.job_url;
        const application = await this.applyService.createApplication(userId, job.id, {
            status: 'applied',
            match_score: matchScore,
            match_reason: matchReason,
            application_method: applicationMethod,
            application_details: {
                url: applicationUrl,
                method: applicationMethod,
                applied_at: new Date().toISOString(),
            },
        });
        await this.applyService.createActivityLog(userId, 'application_created', {
            job_id: job.id,
            application_id: application.id,
            match_score: matchScore,
            method: applicationMethod,
        });
    }
    async runAutoApplyForAllUsers() {
        try {
            middlewares_1.logger.info('Starting auto-apply for all eligible users');
            const result = await (0, db_1.query)(`SELECT DISTINCT p.user_id
         FROM apply_profiles p
         JOIN apply_user_plans up ON p.user_id = up.user_id
         WHERE p.auto_apply_enabled = TRUE
         AND up.status = 'active'
         AND (up.expires_at IS NULL OR up.expires_at > NOW())`);
            const userIds = result.rows.map(r => r.user_id);
            middlewares_1.logger.info(`Found ${userIds.length} users eligible for auto-apply`);
            for (const userId of userIds) {
                try {
                    await this.runAutoApply(userId);
                }
                catch (error) {
                    middlewares_1.logger.error(`Error running auto-apply for user ${userId}:`, error);
                }
            }
            middlewares_1.logger.info('Completed auto-apply for all eligible users');
        }
        catch (error) {
            middlewares_1.logger.error('Error running auto-apply for all users:', error);
        }
    }
}
exports.AutomationService = AutomationService;
//# sourceMappingURL=automationService.js.map