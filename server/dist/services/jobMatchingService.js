"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobMatchingService = void 0;
const db_1 = require("../models/db");
const middlewares_1 = require("../middlewares");
class JobMatchingService {
    constructor(applyService) {
        this.applyService = applyService;
    }
    async matchJobs(profile, jobs) {
        const results = [];
        for (const job of jobs) {
            const match = this.matchJob(profile, job);
            if (match.score > 0) {
                results.push(match);
            }
        }
        results.sort((a, b) => b.score - a.score);
        return results;
    }
    matchJob(profile, job) {
        let score = 0;
        const reasons = [];
        if (profile.job_titles.length > 0 && job.title) {
            const titleLower = job.title.toLowerCase();
            const matchedTitle = profile.job_titles.some(title => titleLower.includes(title.toLowerCase()) || title.toLowerCase().includes(titleLower));
            if (matchedTitle) {
                score += 40;
                reasons.push(`Job title matches: "${job.title}"`);
            }
        }
        if (profile.skills.length > 0 && job.description) {
            const descLower = job.description.toLowerCase();
            const matchedSkills = profile.skills.filter(skill => descLower.includes(skill.toLowerCase()));
            if (matchedSkills.length > 0) {
                const skillScore = Math.min(30, (matchedSkills.length / profile.skills.length) * 30);
                score += skillScore;
                reasons.push(`Matched ${matchedSkills.length} skills: ${matchedSkills.slice(0, 3).join(', ')}`);
            }
        }
        if (profile.locations.length > 0 && job.location) {
            const jobLocationLower = job.location.toLowerCase();
            const matchedLocation = profile.locations.some(loc => jobLocationLower.includes(loc.toLowerCase()) || loc.toLowerCase().includes(jobLocationLower));
            if (matchedLocation) {
                score += 20;
                reasons.push(`Location matches: ${job.location}`);
            }
        }
        if (profile.salary_min && job.salary_min) {
            if (job.salary_min >= profile.salary_min) {
                score += 10;
                reasons.push(`Salary meets minimum requirement`);
            }
        }
        if (profile.include_keywords.length > 0 && job.description) {
            const descLower = job.description.toLowerCase();
            const matchedKeywords = profile.include_keywords.filter(keyword => descLower.includes(keyword.toLowerCase()));
            if (matchedKeywords.length > 0) {
                score += matchedKeywords.length * 2;
                reasons.push(`Contains keywords: ${matchedKeywords.slice(0, 3).join(', ')}`);
            }
        }
        if (profile.exclude_keywords.length > 0 && job.description) {
            const descLower = job.description.toLowerCase();
            const matchedExcludes = profile.exclude_keywords.filter(keyword => descLower.includes(keyword.toLowerCase()));
            if (matchedExcludes.length > 0) {
                score = Math.max(0, score - matchedExcludes.length * 20);
                reasons.push(`Contains excluded keywords: ${matchedExcludes.join(', ')}`);
            }
        }
        score = Math.min(100, Math.max(0, score));
        return {
            job,
            score,
            reasons: reasons.length > 0 ? reasons : ['Basic match'],
        };
    }
    async findJobs(limit = 50) {
        const result = await (0, db_1.query)(`SELECT * FROM apply_jobs
       WHERE (expires_date IS NULL OR expires_date > NOW())
       AND posted_date > NOW() - INTERVAL '30 days'
       ORDER BY posted_date DESC
       LIMIT $1`, [limit]);
        return result.rows;
    }
    async fetchJobsFromSource(source) {
        middlewares_1.logger.info(`Fetching jobs from source: ${source}`);
        return [];
    }
}
exports.JobMatchingService = JobMatchingService;
//# sourceMappingURL=jobMatchingService.js.map