"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cvUploadMiddleware = exports.ApplyController = void 0;
const zod_1 = require("zod");
const applyService_1 = require("../services/applyService");
const applySuggestionsService_1 = require("../services/applySuggestionsService");
const applyLocationService_1 = require("../services/applyLocationService");
const applyCloudinaryService_1 = require("../services/applyCloudinaryService");
const middlewares_1 = require("../middlewares");
const multer_1 = __importDefault(require("multer"));
const applyService = new applyService_1.ApplyService();
const suggestionsService = new applySuggestionsService_1.ApplySuggestionsService();
const locationService = new applyLocationService_1.ApplyLocationService();
const cloudinaryService = new applyCloudinaryService_1.ApplyCloudinaryService();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only PDF and DOCX files are allowed.'));
        }
    },
});
const profileSchema = zod_1.z.object({
    skills: zod_1.z.array(zod_1.z.string()).optional(),
    job_titles: zod_1.z.array(zod_1.z.string()).optional(),
    locations: zod_1.z.array(zod_1.z.string()).optional(),
    salary_min: zod_1.z.number().int().positive().optional(),
    salary_max: zod_1.z.number().int().positive().optional(),
    salary_currency: zod_1.z.string().optional(),
    include_keywords: zod_1.z.array(zod_1.z.string()).optional(),
    exclude_keywords: zod_1.z.array(zod_1.z.string()).optional(),
    cv_url: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    portfolio_urls: zod_1.z.array(zod_1.z.string().url()).optional(),
    preferences: zod_1.z.record(zod_1.z.any()).optional(),
    auto_apply_enabled: zod_1.z.boolean().optional(),
});
class ApplyController {
    async getDashboard(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }
            const [profile, userPlan, applications, activityLogs] = await Promise.all([
                applyService.getProfile(userId).catch(err => {
                    middlewares_1.logger.error('Error getting profile:', err);
                    return null;
                }),
                applyService.getUserPlan(userId).catch(err => {
                    middlewares_1.logger.error('Error getting user plan:', err);
                    return null;
                }),
                applyService.getApplications(userId, { limit: 10 }).catch(err => {
                    middlewares_1.logger.error('Error getting applications:', err);
                    return { applications: [], total: 0 };
                }),
                applyService.getActivityLogs(userId, 10).catch(err => {
                    middlewares_1.logger.error('Error getting activity logs:', err);
                    return { logs: [], total: 0 };
                }),
            ]);
            const today = new Date();
            const dailyQuota = await applyService.getDailyQuota(userId, today).catch(() => 0);
            const dailyLimit = await applyService.getDailyLimit(userId).catch(() => 2);
            res.json({
                profile: profile || null,
                plan: userPlan || null,
                recentApplications: applications?.applications || [],
                recentActivity: activityLogs?.logs || [],
                dailyStats: {
                    applied: dailyQuota || 0,
                    limit: dailyLimit || 2,
                    remaining: Math.max(0, (dailyLimit || 2) - (dailyQuota || 0)),
                },
            });
        }
        catch (error) {
            middlewares_1.logger.error('Get dashboard error:', error);
            res.status(500).json({
                error: 'Failed to get dashboard data',
                message: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
    async getProfile(req, res) {
        try {
            const userId = req.user.userId;
            const profile = await applyService.getProfile(userId);
            if (!profile) {
                res.status(404).json({ error: 'Profile not found' });
                return;
            }
            res.json({ profile });
        }
        catch (error) {
            middlewares_1.logger.error('Get profile error:', error);
            res.status(500).json({ error: 'Failed to get profile' });
        }
    }
    async updateProfile(req, res) {
        try {
            const userId = req.user.userId;
            const validated = profileSchema.parse(req.body);
            const profile = await applyService.createOrUpdateProfile(userId, validated);
            await applyService.createActivityLog(userId, 'profile_updated', {
                changes: Object.keys(validated),
            });
            res.json({ profile });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                res.status(400).json({ error: 'Invalid input', details: error.errors });
                return;
            }
            middlewares_1.logger.error('Update profile error:', error);
            res.status(500).json({ error: 'Failed to update profile' });
        }
    }
    async getPlans(req, res) {
        try {
            const plans = await applyService.getPlans();
            res.json({ plans });
        }
        catch (error) {
            middlewares_1.logger.error('Get plans error:', error);
            res.status(500).json({ error: 'Failed to get plans' });
        }
    }
    async getUserPlan(req, res) {
        try {
            const userId = req.user.userId;
            const userPlan = await applyService.getUserPlan(userId);
            res.json({ plan: userPlan });
        }
        catch (error) {
            middlewares_1.logger.error('Get user plan error:', error);
            res.status(500).json({ error: 'Failed to get user plan' });
        }
    }
    async setUserPlan(req, res) {
        try {
            const userId = req.user.userId;
            const { planId } = req.body;
            if (!planId) {
                res.status(400).json({ error: 'planId is required' });
                return;
            }
            const plan = await applyService.getPlanByName(planId);
            if (!plan) {
                res.status(404).json({ error: 'Plan not found' });
                return;
            }
            const userPlan = await applyService.setUserPlan(userId, plan.id);
            await applyService.createActivityLog(userId, 'plan_changed', {
                plan_id: plan.id,
                plan_name: plan.name,
            });
            res.json({ plan: userPlan });
        }
        catch (error) {
            middlewares_1.logger.error('Set user plan error:', error);
            res.status(500).json({ error: 'Failed to set user plan' });
        }
    }
    async getJobs(req, res) {
        try {
            const { source, limit, offset } = req.query;
            const result = await applyService.getJobs({
                source: source,
                limit: limit ? parseInt(limit) : undefined,
                offset: offset ? parseInt(offset) : undefined,
            });
            res.json(result);
        }
        catch (error) {
            middlewares_1.logger.error('Get jobs error:', error);
            res.status(500).json({ error: 'Failed to get jobs' });
        }
    }
    async getJob(req, res) {
        try {
            const { id } = req.params;
            const job = await applyService.getJobById(id);
            if (!job) {
                res.status(404).json({ error: 'Job not found' });
                return;
            }
            res.json({ job });
        }
        catch (error) {
            middlewares_1.logger.error('Get job error:', error);
            res.status(500).json({ error: 'Failed to get job' });
        }
    }
    async getApplications(req, res) {
        try {
            const userId = req.user.userId;
            const { status, limit, offset } = req.query;
            const result = await applyService.getApplications(userId, {
                status: status,
                limit: limit ? parseInt(limit) : undefined,
                offset: offset ? parseInt(offset) : undefined,
            });
            res.json(result);
        }
        catch (error) {
            middlewares_1.logger.error('Get applications error:', error);
            res.status(500).json({ error: 'Failed to get applications' });
        }
    }
    async getActivityLogs(req, res) {
        try {
            const userId = req.user.userId;
            const { limit, offset } = req.query;
            const result = await applyService.getActivityLogs(userId, limit ? parseInt(limit) : 50, offset ? parseInt(offset) : 0);
            res.json(result);
        }
        catch (error) {
            middlewares_1.logger.error('Get activity logs error:', error);
            res.status(500).json({ error: 'Failed to get activity logs' });
        }
    }
    async toggleAutoApply(req, res) {
        try {
            const userId = req.user.userId;
            const { enabled } = req.body;
            if (typeof enabled !== 'boolean') {
                res.status(400).json({ error: 'enabled must be a boolean' });
                return;
            }
            if (enabled) {
                const profile = await applyService.getProfile(userId);
                if (!profile) {
                    res.status(400).json({ error: 'Please complete your profile first' });
                    return;
                }
                const hasSkills = profile.skills && profile.skills.length > 0;
                const hasJobTitles = profile.job_titles && profile.job_titles.length > 0;
                const hasLocations = profile.locations && profile.locations.length > 0;
                if (!hasSkills || !hasJobTitles || !hasLocations) {
                    res.status(400).json({
                        error: 'Please complete your profile: add skills, job titles, and at least one location',
                    });
                    return;
                }
            }
            const profile = await applyService.createOrUpdateProfile(userId, {
                auto_apply_enabled: enabled,
            });
            await applyService.createActivityLog(userId, enabled ? 'auto_apply_enabled' : 'auto_apply_disabled');
            res.json({ profile });
        }
        catch (error) {
            middlewares_1.logger.error('Toggle auto apply error:', error);
            res.status(500).json({ error: 'Failed to toggle auto apply' });
        }
    }
    async getSuggestions(req, res) {
        try {
            const userId = req.user.userId;
            const { type, q, limit } = req.query;
            if (!type || !['skill', 'job_title', 'keyword', 'location'].includes(type)) {
                res.status(400).json({ error: 'Invalid suggestion type' });
                return;
            }
            const suggestions = await suggestionsService.getSuggestions(type, userId, q || '', limit ? parseInt(limit) : 20);
            res.json({ suggestions });
        }
        catch (error) {
            middlewares_1.logger.error('Get suggestions error:', error);
            res.status(500).json({ error: 'Failed to get suggestions' });
        }
    }
    async searchLocations(req, res) {
        try {
            const { q, limit } = req.query;
            if (!q || typeof q !== 'string' || q.trim().length < 2) {
                res.status(400).json({ error: 'Query must be at least 2 characters' });
                return;
            }
            const locations = await locationService.searchLocations(q.trim(), limit ? parseInt(limit) : 10);
            res.json({ locations });
        }
        catch (error) {
            middlewares_1.logger.error('Search locations error:', error);
            res.status(500).json({ error: 'Failed to search locations' });
        }
    }
    async reverseGeocode(req, res) {
        try {
            middlewares_1.logger.info('Reverse geocode endpoint hit', { query: req.query });
            const { lat, lon } = req.query;
            if (!lat || !lon) {
                middlewares_1.logger.warn('Reverse geocode called without lat/lon');
                res.status(400).json({ error: 'Latitude and longitude are required' });
                return;
            }
            middlewares_1.logger.info(`Reverse geocoding: lat=${lat}, lon=${lon}`);
            const location = await locationService.reverseGeocode(parseFloat(lat), parseFloat(lon));
            if (!location) {
                middlewares_1.logger.warn(`No location found for lat=${lat}, lon=${lon}`);
                res.status(404).json({ error: 'Could not determine location from coordinates. Please try searching for a location instead.' });
                return;
            }
            middlewares_1.logger.info(`Reverse geocode success: ${location.display_name}`);
            res.json({ location });
        }
        catch (error) {
            middlewares_1.logger.error('Reverse geocode error:', error);
            res.status(500).json({
                error: 'Failed to reverse geocode',
                message: process.env.NODE_ENV === 'development' ? error?.message : undefined
            });
        }
    }
    async uploadCV(req, res) {
        try {
            const userId = req.user.userId;
            if (!req.file) {
                res.status(400).json({ error: 'No file uploaded' });
                return;
            }
            if (!cloudinaryService.isConfigured()) {
                middlewares_1.logger.error('CV upload attempted but Cloudinary not configured');
                res.status(500).json({ error: 'File upload service not configured. Please contact support.' });
                return;
            }
            middlewares_1.logger.info(`Uploading CV for user ${userId}: ${req.file.originalname} (${req.file.size} bytes)`);
            const uploadResult = await cloudinaryService.uploadCV(req.file.buffer, req.file.originalname, userId);
            middlewares_1.logger.info(`CV uploaded successfully: ${uploadResult.public_id}`);
            const profile = await applyService.getProfile(userId);
            if (!profile) {
                res.status(404).json({ error: 'Profile not found' });
                return;
            }
            const { query } = await Promise.resolve().then(() => __importStar(require('../models/db')));
            await query(`INSERT INTO apply_cv_assets (
          profile_id, cloudinary_public_id, cloudinary_url, cloudinary_secure_url,
          file_name, file_size, mime_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (profile_id) DO UPDATE SET
          cloudinary_public_id = EXCLUDED.cloudinary_public_id,
          cloudinary_url = EXCLUDED.cloudinary_url,
          cloudinary_secure_url = EXCLUDED.cloudinary_secure_url,
          file_name = EXCLUDED.file_name,
          file_size = EXCLUDED.file_size,
          mime_type = EXCLUDED.mime_type,
          uploaded_at = NOW()`, [
                profile.id,
                uploadResult.public_id,
                uploadResult.url,
                uploadResult.secure_url,
                req.file.originalname,
                uploadResult.bytes,
                req.file.mimetype,
            ]);
            await applyService.createOrUpdateProfile(userId, {
                cv_url: uploadResult.secure_url,
            });
            await applyService.createActivityLog(userId, 'cv_uploaded', {
                file_name: req.file.originalname,
                file_size: uploadResult.bytes,
            });
            res.json({
                success: true,
                cv: {
                    url: uploadResult.secure_url,
                    public_id: uploadResult.public_id,
                    file_name: req.file.originalname,
                    file_size: uploadResult.bytes,
                    uploaded_at: new Date().toISOString(),
                },
            });
        }
        catch (error) {
            middlewares_1.logger.error('Upload CV error:', error);
            res.status(500).json({
                error: error.message || 'Failed to upload CV',
            });
        }
    }
    async deleteCV(req, res) {
        try {
            const userId = req.user.userId;
            const profile = await applyService.getProfile(userId);
            if (!profile) {
                res.status(404).json({ error: 'Profile not found' });
                return;
            }
            const { query } = await Promise.resolve().then(() => __importStar(require('../models/db')));
            const cvResult = await query('SELECT cloudinary_public_id FROM apply_cv_assets WHERE profile_id = $1', [profile.id]);
            if (cvResult.rows.length === 0) {
                res.status(404).json({ error: 'CV not found' });
                return;
            }
            const publicId = cvResult.rows[0].cloudinary_public_id;
            await cloudinaryService.deleteCV(publicId);
            await query('DELETE FROM apply_cv_assets WHERE profile_id = $1', [profile.id]);
            await applyService.createOrUpdateProfile(userId, {
                cv_url: undefined,
            });
            await applyService.createActivityLog(userId, 'cv_deleted');
            res.json({ success: true });
        }
        catch (error) {
            middlewares_1.logger.error('Delete CV error:', error);
            res.status(500).json({
                error: error.message || 'Failed to delete CV',
            });
        }
    }
}
exports.ApplyController = ApplyController;
exports.cvUploadMiddleware = upload.single('cv');
//# sourceMappingURL=applyController.js.map