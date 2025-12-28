import { Router } from 'express';
import { ReelsController } from '../controllers/reelsController';
import { authGuard, optionalAuth } from '../middlewares/auth';
import { generalRateLimit } from '../middlewares';

const router = Router();
const reelsController = new ReelsController();

// Public routes
router.get('/', reelsController.getReels.bind(reelsController));
router.get('/:id', optionalAuth, reelsController.getReel.bind(reelsController));
router.get('/user/:username', optionalAuth, reelsController.getUserReels.bind(reelsController));
router.post('/:id/view', optionalAuth, reelsController.incrementViews.bind(reelsController));

// Protected routes
router.post('/', authGuard, generalRateLimit, reelsController.createReel.bind(reelsController));
router.patch('/:id', authGuard, reelsController.updateReel.bind(reelsController));
router.delete('/:id', authGuard, reelsController.deleteReel.bind(reelsController));

export default router;
