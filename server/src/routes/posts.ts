import { Router } from 'express';
import { PostsController } from '../controllers/postsController';
import { authGuard, optionalAuth } from '../middlewares/auth';
import { generalRateLimit } from '../middlewares';

const router = Router();
const postsController = new PostsController();

// Protected routes
router.post(
  '/',
  authGuard,
  generalRateLimit,
  postsController.createPost.bind(postsController)
);
router.get('/feed', authGuard, postsController.getFeed.bind(postsController));
router.get('/explore', optionalAuth, postsController.getExplore.bind(postsController));

// Public routes
router.get(
  '/trending/hashtags',
  optionalAuth,
  postsController.getTrendingHashtags.bind(postsController)
);
// Search route must be before /:id to avoid route conflicts
router.get(
  '/search',
  optionalAuth,
  postsController.searchPosts.bind(postsController)
);
router.get('/:id', optionalAuth, postsController.getPost.bind(postsController));
router.get(
  '/user/:username',
  optionalAuth,
  postsController.getUserPosts.bind(postsController)
);

// Protected routes for post management
router.patch(
  '/:id',
  authGuard,
  postsController.updatePost.bind(postsController)
);
router.delete(
  '/:id',
  authGuard,
  postsController.deletePost.bind(postsController)
);

// Post interaction routes (hide, report, not interested)
router.post(
  '/:id/hide',
  authGuard,
  postsController.hidePost.bind(postsController)
);
router.post(
  '/:id/report',
  authGuard,
  postsController.reportPost.bind(postsController)
);
router.post(
  '/:id/not-interested',
  authGuard,
  postsController.markNotInterested.bind(postsController)
);

export default router;
