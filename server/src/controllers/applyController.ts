import { Request, Response } from 'express';
import { z } from 'zod';
import { ApplyService } from '../services/applyService';
import {
  ApplySuggestionsService,
  SuggestionType,
} from '../services/applySuggestionsService';
import {
  EnhancedSuggestionsService,
} from '../services/enhancedSuggestionsService';
import {
  suggestionEngine,
} from '../services/genericSuggestionEngine';
import {
  contextBuilder,
} from '../services/profileContextBuilder';
import { ApplyLocationService } from '../services/applyLocationService';
import { LocationSuggestionService } from '../services/locationSuggestionService';
import { ApplyCloudinaryService } from '../services/applyCloudinaryService';
import { query } from '../models/db';
import { logger } from '../middlewares';
import multer from 'multer';
import { sanitizeFilename, generateFallbackFilename } from '../utils/filenameUtils';
import { v2 as cloudinary } from 'cloudinary';

const applyService = new ApplyService();
const suggestionsService = new ApplySuggestionsService();
const enhancedSuggestionsService = new EnhancedSuggestionsService();
const locationService = new ApplyLocationService();
const locationSuggestionService = LocationSuggestionService.getInstance();
const cloudinaryService = new ApplyCloudinaryService();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and DOCX files are allowed.'));
    }
  },
});

const profileSchema = z.object({
  skills: z.array(z.string()).optional(),
  job_titles: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(), // Backward compatible - accepts strings
  salary_min: z.number().int().positive().optional(),
  salary_max: z.number().int().positive().optional(),
  salary_currency: z.string().optional(),
  include_keywords: z.array(z.string()).optional(),
  exclude_keywords: z.array(z.string()).optional(),
  cv_url: z.string().url().optional().or(z.literal('')),
  portfolio_urls: z.array(z.string().url()).optional(),
  preferences: z.record(z.any()).optional(),
  auto_apply_enabled: z.boolean().optional(),
  preferred_run_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(), // HH:MM format
});

export class ApplyController {
  // Dashboard/Overview
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { SourceGeneratorService } = await import('../services/sourceGeneratorService');
      const sourceGenerator = new SourceGeneratorService();

      const [profile, userPlan, applications, activityLogs, sources, jobMatches] = await Promise.all(
        [
          applyService.getProfile(userId).catch(err => {
            logger.error('Error getting profile:', err);
            return null;
          }),
          applyService.getUserPlan(userId).catch(err => {
            logger.error('Error getting user plan:', err);
            return null;
          }),
          applyService.getApplications(userId, { limit: 10 }).catch(err => {
            logger.error('Error getting applications:', err);
            return { applications: [], total: 0 };
          }),
          applyService.getActivityLogs(userId, 10).catch(err => {
            logger.error('Error getting activity logs:', err);
            return { logs: [], total: 0 };
          }),
          sourceGenerator.getSourcesForUser(userId).catch(err => {
            logger.error('Error getting sources:', err);
            return [];
          }),
          applyService.getJobMatches(userId, { limit: 5 }).catch(err => {
            logger.error('Error getting job matches:', err);
            return { matches: [], total: 0 };
          }),
        ]
      );

      const today = new Date();
      const dailyQuota = await applyService
        .getDailyQuota(userId, today)
        .catch(() => 0);
      const dailyLimit = await applyService
        .getDailyLimit(userId)
        .catch(() => 2);

      // Get last run time from activity logs
      const lastRunLog = activityLogs?.logs?.find((log: any) =>
        log.action.includes('auto_apply_completed') || log.action.includes('source_fetch')
      );

      // Get system health (last errors)
      const recentErrors = activityLogs?.logs?.filter((log: any) =>
        log.action.includes('error') || log.action.includes('failed')
      ).slice(0, 3) || [];

      res.json({
        profile: profile || null,
        plan: userPlan || null,
        recentApplications: applications?.applications || [],
        recentActivity: activityLogs?.logs || [],
        sources: sources || [],
        recentMatches: jobMatches?.matches || [],
        systemHealth: {
          lastRunTime: lastRunLog?.created_at || null,
          recentErrors: recentErrors,
          autoApplyEnabled: profile?.auto_apply_enabled || false,
        },
        dailyStats: {
          applied: dailyQuota || 0,
          limit: dailyLimit || 2,
          remaining: Math.max(0, (dailyLimit || 2) - (dailyQuota || 0)),
        },
      });
    } catch (error: any) {
      logger.error('Get dashboard error:', error);
      res.status(500).json({
        error: 'Failed to get dashboard data',
        message:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // Profile endpoints
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      let profile = await applyService.getProfile(userId);

      // Auto-create profile if it doesn't exist
      if (!profile) {
        profile = await applyService.createOrUpdateProfile(userId, {});
        logger.info(`Auto-created profile for user ${userId}`);
      }

      res.json({ profile });
    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const validated = profileSchema.parse(req.body);

      const profile = await applyService.createOrUpdateProfile(
        userId,
        validated
      );

      // Regenerate sources when profile is updated
      try {
        const { SourceGeneratorService } = await import('../services/sourceGeneratorService');
        const sourceGenerator = new SourceGeneratorService();
        await sourceGenerator.regenerateSourcesForUser(userId, profile);
        logger.info(`Regenerated sources for user ${userId} after profile update`);
      } catch (sourceError: any) {
        logger.error(`Failed to regenerate sources for user ${userId}:`, sourceError);
        // Don't fail the profile update if source generation fails
      }

      // Log activity
      await applyService.createActivityLog(userId, 'profile_updated', {
        changes: Object.keys(validated),
      });

      res.json({ profile });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid input', details: error.errors });
        return;
      }
      logger.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  // Plans endpoints
  async getPlans(req: Request, res: Response): Promise<void> {
    try {
      const plans = await applyService.getPlans();
      res.json({ plans });
    } catch (error) {
      logger.error('Get plans error:', error);
      res.status(500).json({ error: 'Failed to get plans' });
    }
  }

  async getUserPlan(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const userPlan = await applyService.getUserPlan(userId);
      res.json({ plan: userPlan });
    } catch (error) {
      logger.error('Get user plan error:', error);
      res.status(500).json({ error: 'Failed to get user plan' });
    }
  }

  async setUserPlan(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      
      if (!userId) {
        logger.warn('setUserPlan called without authenticated user');
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { planId } = req.body;

      if (!planId) {
        res.status(400).json({ error: 'planId is required' });
        return;
      }

      logger.info(`Setting plan for user ${userId}: planId=${planId}`);

      // planId can be either UUID or plan name (free, pro, premium)
      let plan;
      if (planId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // It's a UUID, get plan by ID
        logger.info(`Looking up plan by UUID: ${planId}`);
        const result = await query('SELECT * FROM apply_plans WHERE id = $1', [planId]);
        plan = result.rows[0];
        if (plan && typeof plan.features === 'string') {
          plan.features = JSON.parse(plan.features);
        }
      } else {
        // It's a plan name, get by name
        logger.info(`Looking up plan by name: ${planId}`);
        plan = await applyService.getPlanByName(planId);
      }

      if (!plan) {
        logger.warn(`Plan not found: ${planId}`);
        res.status(404).json({ error: `Plan not found: ${planId}` });
        return;
      }

      logger.info(`Found plan: ${plan.name} (${plan.id}), setting for user ${userId}`);
      const userPlan = await applyService.setUserPlan(userId, plan.id);
      logger.info(`Plan set successfully for user ${userId}`);

      // Log activity
      await applyService.createActivityLog(userId, 'plan_changed', {
        plan_id: plan.id,
        plan_name: plan.name,
      });

      res.json({ plan: userPlan });
    } catch (error: any) {
      logger.error('Set user plan error:', error);
      logger.error('Error details:', {
        message: error.message,
        stack: error.stack,
        userId: (req as any).user?.userId,
        planId: req.body?.planId
      });
      res.status(500).json({ 
        error: 'Failed to set user plan',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Jobs endpoints
  async getJobs(req: Request, res: Response): Promise<void> {
    try {
      const { source, limit, offset } = req.query;
      const result = await applyService.getJobs({
        source: source as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(result);
    } catch (error) {
      logger.error('Get jobs error:', error);
      res.status(500).json({ error: 'Failed to get jobs' });
    }
  }

  async getJob(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const job = await applyService.getJobById(id);

      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      res.json({ job });
    } catch (error) {
      logger.error('Get job error:', error);
      res.status(500).json({ error: 'Failed to get job' });
    }
  }

  // Applications endpoints
  async getApplications(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { status, limit, offset } = req.query;
      const result = await applyService.getApplications(userId, {
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(result);
    } catch (error) {
      logger.error('Get applications error:', error);
      res.status(500).json({ error: 'Failed to get applications' });
    }
  }

  // Activity logs endpoint
  async getActivityLogs(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { limit, offset } = req.query;
      const result = await applyService.getActivityLogs(
        userId,
        limit ? parseInt(limit as string) : 50,
        offset ? parseInt(offset as string) : 0
      );
      res.json(result);
    } catch (error) {
      logger.error('Get activity logs error:', error);
      res.status(500).json({ error: 'Failed to get activity logs' });
    }
  }

  // Automation control
  async toggleAutoApply(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        res.status(400).json({ error: 'enabled must be a boolean' });
        return;
      }

      // Validate profile completeness before enabling
      if (enabled) {
        const profile = await applyService.getProfile(userId);
        if (!profile) {
          res.status(400).json({ error: 'Please complete your profile first' });
          return;
        }

        // Check minimum requirements
        const hasSkills = profile.skills && profile.skills.length > 0;
        const hasJobTitles =
          profile.job_titles && profile.job_titles.length > 0;
        const hasLocations = profile.locations && profile.locations.length > 0;

        if (!hasSkills || !hasJobTitles || !hasLocations) {
          res.status(400).json({
            error:
              'Please complete your profile: add skills, job titles, and at least one location',
          });
          return;
        }
      }

      const profile = await applyService.createOrUpdateProfile(userId, {
        auto_apply_enabled: enabled,
      });

      // Log activity
      await applyService.createActivityLog(
        userId,
        enabled ? 'auto_apply_enabled' : 'auto_apply_disabled'
      );

      res.json({ profile });
    } catch (error) {
      logger.error('Toggle auto apply error:', error);
      res.status(500).json({ error: 'Failed to toggle auto apply' });
    }
  }

  // Suggestions endpoint (context-aware)
  async getSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const {
        type,
        q,
        limit,
        skills,
        jobTitles,
        includeKeywords,
        excludeKeywords,
        locations,
      } = req.query;

      if (
        !type ||
        !['skill', 'job_title', 'keyword', 'location'].includes(type as string)
      ) {
        res.status(400).json({ error: 'Invalid suggestion type' });
        return;
      }

      // Parse context from query params
      const contextParams = {
        skills: this.parseArrayParam(skills),
        jobTitles: this.parseArrayParam(jobTitles),
        includeKeywords: this.parseArrayParam(includeKeywords),
        excludeKeywords: this.parseArrayParam(excludeKeywords),
        locations: this.parseLocationsParam(locations),
      };

      // Build profile context
      const context = contextBuilder.buildContext(contextParams);

      // Get selected values for the current field type
      const selectedValues =
        type === 'skill'
          ? contextParams.skills
          : type === 'job_title'
            ? contextParams.jobTitles
            : type === 'keyword'
              ? contextParams.includeKeywords
              : [];

      // Use generic suggestion engine
      const ranked = suggestionEngine.getSuggestions(
        type as 'skill' | 'job_title' | 'keyword',
        (q as string) || '',
        context,
        selectedValues,
        limit ? parseInt(limit as string) : 20
      );

      // Separate matches and recommendations
      const matches = ranked.filter(s => !s.isRecommended);
      const recommended = ranked.filter(s => s.isRecommended);

      // Record usage for analytics (non-blocking)
      if (ranked.length > 0) {
        enhancedSuggestionsService
          .recordUsage(type as SuggestionType, ranked[0].value)
          .catch(() => {});
      }

      res.json({
        matches: matches.map(s => ({
          value: s.value,
          category: s.category,
          is_recommended: false,
        })),
        recommended: recommended.map(s => ({
          value: s.value,
          category: s.category,
          is_recommended: true,
        })),
        // Backward compatibility
        suggestions: ranked.map(s => ({
          value: s.value,
          category: s.category,
          is_recommended: s.isRecommended,
        })),
      });
    } catch (error) {
      logger.error('Get suggestions error:', error);
      // Fallback to basic service
      try {
        const userId = (req as any).user.userId;
        const { type, q, limit } = req.query;
        const suggestions = await suggestionsService.getSuggestions(
          type as SuggestionType,
          userId,
          (q as string) || '',
          limit ? parseInt(limit as string) : 20
        );
        res.json({ suggestions, matches: suggestions, recommended: [] });
      } catch (fallbackError) {
        logger.error('Fallback suggestions error:', fallbackError);
        res.status(500).json({ error: 'Failed to get suggestions' });
      }
    }
  }

  /**
   * Parse array parameter from query string
   */
  private parseArrayParam(param: any): string[] {
    if (!param) return [];
    if (Array.isArray(param)) return param as string[];
    if (typeof param === 'string') {
      return param.split(',').filter(Boolean).map(s => s.trim());
    }
    return [];
  }

  /**
   * Parse locations parameter
   */
  private parseLocationsParam(param: any): Array<{
    display_name: string;
    country?: string;
    city?: string;
    location_type?: string;
  }> {
    if (!param) return [];
    try {
      if (typeof param === 'string') {
        return JSON.parse(param);
      }
      if (Array.isArray(param)) {
        return param as any;
      }
    } catch {
      // If parsing fails, return empty
    }
    return [];
  }

  // Location search endpoint (legacy - uses Nominatim)
  async searchLocations(req: Request, res: Response): Promise<void> {
    try {
      const { q, limit } = req.query;

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        res.status(400).json({ error: 'Query must be at least 2 characters' });
        return;
      }

      const locations = await locationService.searchLocations(
        q.trim(),
        limit ? parseInt(limit as string) : 10
      );

      res.json({ locations });
    } catch (error) {
      logger.error('Search locations error:', error);
      res.status(500).json({ error: 'Failed to search locations' });
    }
  }

  // Location suggestions endpoint (new - uses database with context)
  async getLocationSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { q, limit, selectedSkills, selectedJobTitles, includeKeywords, excludeKeywords, locations } = req.query;

      logger.info(`Location suggestions request: q="${q}", userId=${userId}`);

      // Build profile context
      const contextParams = {
        userId,
        selectedSkills: this.parseArrayParam(selectedSkills),
        selectedJobTitles: this.parseArrayParam(selectedJobTitles),
        includeKeywords: this.parseArrayParam(includeKeywords),
        excludeKeywords: this.parseArrayParam(excludeKeywords),
        locations: this.parseLocationsParam(locations),
      };

      const context = contextBuilder.buildContext(contextParams);

      // Get location suggestions
      const suggestions = await locationSuggestionService.getSuggestions(
        (q as string) || '',
        context,
        limit ? parseInt(limit as string) : 20
      );

      logger.info(`Location suggestions returned: ${suggestions.length} results for query "${q}"`);

      // Separate matches and recommendations
      const matches = suggestions.filter(s => !s.isRecommended);
      const recommended = suggestions.filter(s => s.isRecommended);

      const response = {
        matches: matches.map(s => ({
          value: s.displayName,
          display_name: s.displayName,
          type: s.type,
          country: s.country,
          city: s.city,
          region: s.region,
          latitude: s.latitude,
          longitude: s.longitude,
        })),
        recommended: recommended.map(s => ({
          value: s.displayName,
          display_name: s.displayName,
          type: s.type,
          country: s.country,
          city: s.city,
          region: s.region,
          latitude: s.latitude,
          longitude: s.longitude,
        })),
      };

      logger.debug(`Response: ${response.matches.length} matches, ${response.recommended.length} recommended`);
      res.json(response);
    } catch (error) {
      logger.error('Get location suggestions error:', error);
      res.status(500).json({ error: 'Failed to get location suggestions' });
    }
  }

  // Reverse geocode endpoint
  async reverseGeocode(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Reverse geocode endpoint hit', { query: req.query });
      const { lat, lon } = req.query;

      if (!lat || !lon) {
        logger.warn('Reverse geocode called without lat/lon');
        res.status(400).json({ error: 'Latitude and longitude are required' });
        return;
      }

      logger.info(`Reverse geocoding: lat=${lat}, lon=${lon}`);
      const location = await locationService.reverseGeocode(
        parseFloat(lat as string),
        parseFloat(lon as string)
      );

      if (!location) {
        logger.warn(`No location found for lat=${lat}, lon=${lon}`);
        res.status(404).json({
          error:
            'Could not determine location from coordinates. Please try searching for a location instead.',
          coordinates: { lat, lon },
        });
        return;
      }

      logger.info(`Reverse geocode success: ${location.display_name}`);
      res.json({ location });
    } catch (error: any) {
      logger.error('Reverse geocode error:', error);
      res.status(500).json({
        error: 'Failed to reverse geocode',
        message:
          process.env.NODE_ENV === 'development' ? error?.message : undefined,
      });
    }
  }

  // CV upload endpoint
  async uploadCV(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      if (!cloudinaryService.isConfigured()) {
        logger.error('CV upload attempted but Cloudinary not configured');
        res
          .status(500)
          .json({
            error:
              'File upload service not configured. Please contact support.',
          });
        return;
      }

      // Sanitize filename
      const sanitizedFileName = sanitizeFilename(req.file.originalname);
      
      // Upload to Cloudinary
      logger.info(
        `Uploading CV for user ${userId}: ${req.file.originalname} -> ${sanitizedFileName} (${req.file.size} bytes)`
      );
      const uploadResult = await cloudinaryService.uploadCV(
        req.file.buffer,
        sanitizedFileName,
        userId
      );
      logger.info(`CV uploaded successfully: ${uploadResult.public_id}`);

      // Get or create profile
      let profile = await applyService.getProfile(userId);
      if (!profile) {
        // Auto-create profile if it doesn't exist
        profile = await applyService.createOrUpdateProfile(userId, {});
        logger.info(`Auto-created profile for user ${userId} during CV upload`);
      }

      // Save CV asset info to database with sanitized filename
      const { query } = await import('../models/db');
      await query(
        `INSERT INTO apply_cv_assets (
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
          uploaded_at = NOW()`,
        [
          profile.id,
          uploadResult.public_id,
          uploadResult.url,
          uploadResult.secure_url,
          sanitizedFileName, // Store sanitized filename
          uploadResult.bytes,
          req.file.mimetype,
        ]
      );

      // Update profile cv_url for backward compatibility
      await applyService.createOrUpdateProfile(userId, {
        cv_url: uploadResult.secure_url,
      });

      // Log activity
      await applyService.createActivityLog(userId, 'cv_uploaded', {
        file_name: sanitizedFileName,
        file_size: uploadResult.bytes,
      });

      res.json({
        success: true,
        cv: {
          url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
          file_name: sanitizedFileName, // Return sanitized filename
          file_size: uploadResult.bytes,
          mime_type: req.file.mimetype,
          uploaded_at: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      logger.error('Upload CV error:', error);
      res.status(500).json({
        error: error.message || 'Failed to upload CV',
      });
    }
  }

  // View CV endpoint (inline for PDFs)
  async viewCV(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { download } = req.query; // Optional download parameter

      const profile = await applyService.getProfile(userId);
      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      if (!profile.id) {
        logger.error('Profile missing id field:', { userId, profile });
        res.status(500).json({ error: 'Profile data error' });
        return;
      }

      // Get CV asset
      const { query } = await import('../models/db');
      const cvResult = await query(
        `SELECT cloudinary_public_id, cloudinary_secure_url, file_name, mime_type 
         FROM apply_cv_assets WHERE profile_id = $1`,
        [profile.id]
      );

      if (cvResult.rows.length === 0) {
        res.status(404).json({ error: 'CV not found' });
        return;
      }

      const cvAsset = cvResult.rows[0];
      const fileName = cvAsset.file_name || generateFallbackFilename(cvAsset.mime_type);
      const mimeType = cvAsset.mime_type || 'application/pdf';
      const isPDF = mimeType === 'application/pdf';
      const isDOCX = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      // Determine disposition: inline for PDFs (unless download=true), attachment for DOCX
      const shouldDownload = download === 'true' || !isPDF;
      const disposition = shouldDownload ? 'attachment' : 'inline';

      // Fetch file from Cloudinary
      try {
        const fileUrl = cvAsset.cloudinary_secure_url;
        
        // Use node-fetch or built-in fetch
        let fetchFn: typeof fetch;
        try {
          // Try built-in fetch first (Node.js 18+)
          if (typeof globalThis.fetch === 'function') {
            fetchFn = globalThis.fetch;
          } else {
            // Fallback to node-fetch
            const nodeFetch = (await import('node-fetch')).default;
            fetchFn = nodeFetch as any;
          }
        } catch (importError) {
          logger.error('Failed to load fetch:', importError);
          throw new Error('Failed to load fetch module');
        }

        const response = await fetchFn(fileUrl);

        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }

        // Set headers before streaming
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

        // Handle response body - convert to buffer for reliability
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);
      } catch (error: any) {
        logger.error('Error fetching CV from Cloudinary:', error);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Failed to retrieve CV file',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined,
          });
        } else {
          res.end();
        }
      }
    } catch (error: any) {
      logger.error('View CV error:', error);
      res.status(500).json({
        error: error.message || 'Failed to view CV',
      });
    }
  }

  // Download CV endpoint (forces download)
  async downloadCV(req: Request, res: Response): Promise<void> {
    // Create a new request object with download=true
    const modifiedReq = {
      ...req,
      query: {
        ...req.query,
        download: 'true',
      },
    } as Request;
    return this.viewCV(modifiedReq, res);
  }

  // Delete CV endpoint
  async deleteCV(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;

      const profile = await applyService.getProfile(userId);
      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      // Get CV asset
      const { query } = await import('../models/db');
      const cvResult = await query(
        'SELECT cloudinary_public_id FROM apply_cv_assets WHERE profile_id = $1',
        [profile.id]
      );

      if (cvResult.rows.length === 0) {
        res.status(404).json({ error: 'CV not found' });
        return;
      }

      const publicId = cvResult.rows[0].cloudinary_public_id;

      // Delete from Cloudinary
      await cloudinaryService.deleteCV(publicId);

      // Delete from database
      await query('DELETE FROM apply_cv_assets WHERE profile_id = $1', [
        profile.id,
      ]);

      // Update profile
      await applyService.createOrUpdateProfile(userId, {
        cv_url: undefined,
      });

      // Log activity
      await applyService.createActivityLog(userId, 'cv_deleted');

      res.json({ success: true });
    } catch (error: any) {
      logger.error('Delete CV error:', error);
      res.status(500).json({
        error: error.message || 'Failed to delete CV',
      });
    }
  }

  // Job matches endpoint
  async getJobMatches(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { status, limit, offset } = req.query;
      const result = await applyService.getJobMatches(userId, {
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(result);
    } catch (error) {
      logger.error('Get job matches error:', error);
      res.status(500).json({ error: 'Failed to get job matches' });
    }
  }

  // Assisted apply endpoints
  async getAssistedApplies(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const result = await applyService.getApplications(userId, {
        status: 'assisted_required',
        limit: 100,
      });
      res.json(result);
    } catch (error) {
      logger.error('Get assisted applies error:', error);
      res.status(500).json({ error: 'Failed to get assisted applies' });
    }
  }

  async completeAssistedApply(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { id } = req.params;

      // Update application status
      const application = await applyService.createApplication(userId, id, {
        status: 'applied',
      });

      // Update job match status
      await applyService.createJobMatch(userId, id, 0, [], 'applied');

      // Log activity
      await applyService.createActivityLog(userId, 'assisted_completed', {
        job_id: id,
        application_id: application.id,
      });

      res.json({ success: true, application });
    } catch (error) {
      logger.error('Complete assisted apply error:', error);
      res.status(500).json({ error: 'Failed to complete assisted apply' });
    }
  }

  // Sources endpoint
  async getSources(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { SourceGeneratorService } = await import('../services/sourceGeneratorService');
      const sourceGenerator = new SourceGeneratorService();
      const sources = await sourceGenerator.getSourcesForUser(userId);
      res.json({ sources });
    } catch (error) {
      logger.error('Get sources error:', error);
      res.status(500).json({ error: 'Failed to get sources' });
    }
  }

  async regenerateSources(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const profile = await applyService.getProfile(userId);
      
      if (!profile) {
        res.status(404).json({ error: 'Profile not found. Please complete your profile first.' });
        return;
      }

      const { SourceGeneratorService } = await import('../services/sourceGeneratorService');
      const sourceGenerator = new SourceGeneratorService();
      await sourceGenerator.regenerateSourcesForUser(userId, profile);
      
      const sources = await sourceGenerator.getSourcesForUser(userId);
      
      // Log activity
      await applyService.createActivityLog(userId, 'sources_regenerated', {
        source_count: sources.length,
      });

      logger.info(`Regenerated ${sources.length} sources for user ${userId}`);
      res.json({ 
        success: true, 
        sources,
        message: `Generated ${sources.length} job source(s)` 
      });
    } catch (error: any) {
      logger.error('Regenerate sources error:', error);
      res.status(500).json({ 
        error: 'Failed to regenerate sources',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Apply Now - Immediately trigger automation
  async applyNow(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const profile = await applyService.getProfile(userId);
      
      if (!profile) {
        res.status(404).json({ error: 'Profile not found. Please complete your profile first.' });
        return;
      }

      if (!profile.auto_apply_enabled) {
        res.status(400).json({ error: 'Auto-apply is not enabled. Please enable it first.' });
        return;
      }

      const plan = await applyService.getUserPlan(userId);
      if (!plan) {
        res.status(400).json({ error: 'No plan selected. Please select a plan first.' });
        return;
      }

      // Create a run ID for tracking
      const runId = `manual_${Date.now()}_${userId}`;

      // Log activity with run ID
      await applyService.createActivityLog(userId, 'manual_apply_triggered', {
        run_id: runId,
        triggered_by: 'user',
        timestamp: new Date().toISOString(),
        status: 'starting',
      });

      // Run automation in background (don't wait for it to complete)
      const { AutomationService } = await import('../services/automationService');
      const { JobMatchingService } = await import('../services/jobMatchingService');
      const { SourceGeneratorService } = await import('../services/sourceGeneratorService');
      
      const automationService = new AutomationService(
        applyService,
        new JobMatchingService(),
        new SourceGeneratorService()
      );

      // Run asynchronously with run ID
      automationService.runAutoApply(userId, runId).catch((error: any) => {
        logger.error(`Error in manual apply run for user ${userId}:`, error);
        applyService.createActivityLog(userId, 'manual_apply_failed', {
          run_id: runId,
          error: error.message,
          status: 'failed',
        }).catch(() => {});
      });

      res.json({ 
        success: true,
        run_id: runId,
        message: 'Automation started. Applications will be processed in the background.',
      });
    } catch (error: any) {
      logger.error('Apply now error:', error);
      res.status(500).json({ 
        error: 'Failed to start automation',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get automation progress
  async getProgress(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { runId } = req.query;

      if (!runId) {
        res.status(400).json({ error: 'runId is required' });
        return;
      }

      // Get recent activity logs for this run
      const logs = await applyService.getActivityLogs(userId, 50);
      const runLogs = logs.logs.filter((log: any) => {
        let details = log.details;
        // Parse details if it's a string
        if (typeof details === 'string') {
          try {
            details = JSON.parse(details);
          } catch {
            return false;
          }
        }
        return details && typeof details === 'object' && details.run_id === runId;
      }).map((log: any) => {
        // Ensure details is parsed
        if (typeof log.details === 'string') {
          try {
            log.details = JSON.parse(log.details);
          } catch {
            log.details = {};
          }
        }
        return log;
      });

      // Determine current status
      let status = 'running';
      let currentStep = 'Initializing...';
      let progress = 0;
      const steps: any[] = [];

      // Parse logs to determine progress
      const hasTriggered = runLogs.some((log: any) => log.action === 'manual_apply_triggered');
      const hasSourceFetchStart = runLogs.some((log: any) => log.action === 'source_fetch_start');
      const hasSourceFetchProgress = runLogs.find((log: any) => log.action === 'source_fetch_progress');
      const hasSourceFetch = runLogs.some((log: any) => log.action === 'source_fetch');
      const hasMatchStart = runLogs.some((log: any) => log.action === 'match_start');
      const hasMatchProgress = runLogs.find((log: any) => log.action === 'match_progress');
      const hasMatchCreated = runLogs.some((log: any) => log.action === 'match_created');
      const hasJobProcessing = runLogs.find((log: any) => log.action === 'job_processing');
      const hasApplied = runLogs.some((log: any) => log.action === 'application_created');
      const hasCompleted = runLogs.some((log: any) => log.action === 'auto_apply_completed');
      const hasLimitReached = runLogs.some((log: any) => log.action === 'auto_apply_limit_reached');
      const hasFailed = runLogs.some((log: any) => log.action === 'manual_apply_failed');

      if (hasFailed) {
        status = 'failed';
        currentStep = 'Failed';
        progress = 0;
      } else if (hasCompleted || hasLimitReached) {
        status = 'completed';
        if (hasLimitReached) {
          const limitLog = runLogs.find((log: any) => log.action === 'auto_apply_limit_reached');
          currentStep = `Daily limit reached (${limitLog?.details?.applied || 0}/${limitLog?.details?.limit || 0})`;
        } else {
          currentStep = 'Completed';
        }
        progress = 100;
      } else if (hasApplied || hasJobProcessing) {
        status = 'applying';
        // Calculate progress based on actual jobs processed
        const totalJobs = matchLog?.details?.queued || matchLog?.details?.matched || 0;
        const processedJobs = applyLogs.length;
        if (hasJobProcessing) {
          const currentJob = hasJobProcessing.details;
          currentStep = `Applying to: ${currentJob?.job_title || 'Job'} at ${currentJob?.job_company || 'Company'}`;
          if (totalJobs > 0) {
            progress = Math.min(90, 60 + Math.floor((processedJobs / totalJobs) * 30));
          } else {
            progress = 80;
          }
        } else if (totalJobs > 0) {
          progress = Math.min(90, 60 + Math.floor((processedJobs / totalJobs) * 30));
          currentStep = `Applying to jobs... (${processedJobs}/${totalJobs})`;
        } else {
          currentStep = 'Applying to jobs...';
          progress = 80;
        }
      } else if (hasMatchCreated || hasMatchProgress) {
        status = 'matching';
        if (hasMatchProgress) {
          const matchCount = hasMatchProgress.details?.matched_count || 0;
          currentStep = `Matching jobs... (${matchCount} matched)`;
        } else {
          currentStep = 'Matching jobs...';
        }
        progress = 60;
      } else if (hasSourceFetch || hasSourceFetchProgress || hasSourceFetchStart) {
        status = 'fetching';
        if (hasSourceFetchProgress) {
          const jobsFound = hasSourceFetchProgress.details?.jobs_found || 0;
          currentStep = `Fetching jobs... (${jobsFound} found)`;
          progress = 35;
        } else if (hasSourceFetchStart) {
          currentStep = 'Fetching jobs from sources...';
          progress = 30;
        } else {
          currentStep = 'Fetching jobs from sources...';
          progress = 40;
        }
      } else if (hasTriggered) {
        status = 'starting';
        currentStep = 'Starting automation...';
        progress = 20;
      }

      // Extract details from logs (ensure details are parsed)
      const sourceFetchLog = runLogs.find((log: any) => log.action === 'source_fetch');
      const sourceFetchProgressLog = runLogs.find((log: any) => log.action === 'source_fetch_progress');
      const matchLog = runLogs.find((log: any) => log.action === 'match_created');
      const matchProgressLog = runLogs.find((log: any) => log.action === 'match_progress');
      const applyLogs = runLogs.filter((log: any) => log.action === 'application_created');
      const completedLog = runLogs.find((log: any) => log.action === 'auto_apply_completed');
      const limitReachedLog = runLogs.find((log: any) => log.action === 'auto_apply_limit_reached');
      const currentJobLog = runLogs.find((log: any) => log.action === 'job_processing');

      // Count applied jobs from all application_created logs
      const appliedCount = applyLogs.length || completedLog?.details?.applied || 0;
      const totalJobs = matchLog?.details?.queued || matchLog?.details?.matched || 0;

      // Calculate time elapsed and estimate
      const firstLog = runLogs[runLogs.length - 1]; // Oldest log
      const startTime = firstLog ? new Date(firstLog.created_at).getTime() : Date.now();
      const elapsedMs = Date.now() - startTime;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      
      // Estimate remaining time (average 3 seconds per job)
      const processedJobs = appliedCount + (completedLog?.details?.assisted || 0) + (completedLog?.details?.failed || 0);
      const remainingJobs = totalJobs - processedJobs;
      const avgTimePerJob = processedJobs > 0 ? elapsedMs / processedJobs : 3000; // Default 3 seconds
      const estimatedRemainingMs = remainingJobs * avgTimePerJob;

      res.json({
        run_id: runId,
        status,
        current_step: currentStep,
        progress,
        current_job: currentJobLog ? {
          title: currentJobLog.details?.job_title || 'Unknown',
          company: currentJobLog.details?.job_company || 'Unknown',
          index: currentJobLog.details?.current_index || 0,
          total: currentJobLog.details?.total_jobs || totalJobs,
        } : null,
        time: {
          elapsed_seconds: elapsedSeconds,
          elapsed_formatted: this.formatTime(elapsedSeconds),
          estimated_remaining_seconds: Math.ceil(estimatedRemainingMs / 1000),
          estimated_remaining_formatted: this.formatTime(Math.ceil(estimatedRemainingMs / 1000)),
        },
        details: {
          jobs_fetched: sourceFetchProgressLog?.details?.jobs_found || sourceFetchLog?.details?.jobs_fetched || limitReachedLog?.details?.jobs_fetched || 0,
          jobs_matched: matchProgressLog?.details?.matched_count || matchLog?.details?.matched || 0,
          jobs_applied: appliedCount,
          jobs_failed: completedLog?.details?.failed || 0,
          total_jobs: totalJobs,
          processed_jobs: processedJobs,
          limit_reached: !!limitReachedLog,
          daily_limit: limitReachedLog?.details?.limit || null,
          daily_applied: limitReachedLog?.details?.applied || null,
        },
        logs: runLogs.slice(0, 10).map((log: any) => ({
          action: log.action,
          message: this.getLogMessage(log),
          timestamp: log.created_at,
        })),
      });
    } catch (error: any) {
      logger.error('Get progress error:', error);
      res.status(500).json({ 
        error: 'Failed to get progress',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  private getLogMessage(log: any): string {
    const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
    
    switch (log.action) {
      case 'manual_apply_triggered':
        return 'Automation started';
      case 'source_fetch':
        return `Fetched ${details.jobs_fetched || 0} jobs from sources`;
      case 'match_created':
        return `Matched ${details.matched || 0} jobs`;
      case 'job_processing':
        return `Processing: ${details.job_title || 'Job'} at ${details.job_company || 'Company'}`;
      case 'application_created':
        const jobInfo = details.job_title ? ` (${details.job_title}${details.job_company ? ` at ${details.job_company}` : ''})` : '';
        return `Applied to job${jobInfo}`;
      case 'auto_apply_completed':
        return `Completed: ${details.applied || 0} applied, ${details.failed || 0} failed`;
      case 'manual_apply_failed':
        return `Failed: ${details.error || 'Unknown error'}`;
      default:
        return log.action.replace(/_/g, ' ');
    }
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds} sec${seconds !== 1 ? 's' : ''}`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (secs === 0) {
        return `${minutes} min${minutes !== 1 ? 's' : ''}`;
      }
      return `${minutes} min ${secs} sec${secs !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
    }
  }
}

// Export upload middleware for use in routes
export const cvUploadMiddleware = upload.single('cv');
