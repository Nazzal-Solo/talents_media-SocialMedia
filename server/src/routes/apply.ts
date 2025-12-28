import { Router } from 'express';
import {
  ApplyController,
  cvUploadMiddleware,
} from '../controllers/applyController';
import { authGuard } from '../middlewares/auth';
import { generalRateLimit, logger } from '../middlewares';

const router = Router();
const applyController = new ApplyController();

// Log that routes module is loading
logger.info('📋 Loading apply routes...');

// All routes require authentication
router.use(authGuard);

// Dashboard
router.get('/dashboard', applyController.getDashboard.bind(applyController));

// Profile
router.get('/profile', applyController.getProfile.bind(applyController));
router.put(
  '/profile',
  generalRateLimit,
  applyController.updateProfile.bind(applyController)
);

// Plans
router.get('/plans', applyController.getPlans.bind(applyController));
router.get('/plan', applyController.getUserPlan.bind(applyController));
router.post(
  '/plan',
  generalRateLimit,
  applyController.setUserPlan.bind(applyController)
);

// Locations - Must be before /jobs/:id to avoid route conflicts
// IMPORTANT: This route MUST come before /jobs/:id or Express will match "locations" as a job ID
// Using a more specific path pattern to ensure it matches before /jobs/:id
router.get('/locations/reverse', (req, res, next) => {
  logger.info('[ROUTE] /locations/reverse MATCHED!', {
    method: req.method,
    url: req.url,
    query: req.query,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
  });
  console.log('[DEBUG] Reverse geocode route called', req.path, req.query);
  applyController.reverseGeocode(req, res).catch(next);
});

router.get(
  '/locations/search',
  applyController.searchLocations.bind(applyController)
);
router.get(
  '/locations/suggestions',
  applyController.getLocationSuggestions.bind(applyController)
);

// Log route registration after all routes are defined
logger.info(
  '✅ Apply routes loaded - /locations/reverse is registered BEFORE /jobs/:id'
);

// Jobs - Parameterized route must come after specific routes
router.get('/jobs', applyController.getJobs.bind(applyController));
router.get('/jobs/:id', applyController.getJob.bind(applyController));

// Applications
router.get(
  '/applications',
  applyController.getApplications.bind(applyController)
);

// Activity logs
router.get('/activity', applyController.getActivityLogs.bind(applyController));

// Automation control
router.post(
  '/automation/toggle',
  generalRateLimit,
  applyController.toggleAutoApply.bind(applyController)
);

// Job matches
router.get('/matches', applyController.getJobMatches.bind(applyController));

// Assisted apply
router.get('/assisted', applyController.getAssistedApplies.bind(applyController));
router.post(
  '/assisted/:id/complete',
  generalRateLimit,
  applyController.completeAssistedApply.bind(applyController)
);

// Sources
router.get('/sources', applyController.getSources.bind(applyController));
router.post(
  '/sources/regenerate',
  generalRateLimit,
  applyController.regenerateSources.bind(applyController)
);

// Automation
router.post(
  '/automation/apply-now',
  generalRateLimit,
  applyController.applyNow.bind(applyController)
);
router.get(
  '/automation/progress',
  generalRateLimit,
  applyController.getProgress.bind(applyController)
);

// Suggestions
router.get(
  '/suggestions',
  applyController.getSuggestions.bind(applyController)
);

// CV upload and management
router.post(
  '/cv/upload',
  cvUploadMiddleware,
  generalRateLimit,
  applyController.uploadCV.bind(applyController)
);
router.get(
  '/cv/view',
  applyController.viewCV.bind(applyController)
);
router.get(
  '/cv/download',
  applyController.downloadCV.bind(applyController)
);
router.delete(
  '/cv',
  generalRateLimit,
  applyController.deleteCV.bind(applyController)
);

export default router;
