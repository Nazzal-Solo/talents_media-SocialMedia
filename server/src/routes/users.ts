import { Router } from 'express';
import { UsersController } from '../controllers/usersController';
import { authGuard, optionalAuth } from '../middlewares/auth';
import { generalRateLimit } from '../middlewares';

const router = Router();
const usersController = new UsersController();

// Protected routes
router.get('/me', authGuard, usersController.getMe.bind(usersController));
router.patch(
  '/me',
  authGuard,
  generalRateLimit,
  usersController.updateProfile.bind(usersController)
);

// Search and list routes (must be before /:username routes)
router.get(
  '/search',
  optionalAuth,
  usersController.searchUsers.bind(usersController)
);
router.get(
  '/all',
  optionalAuth,
  usersController.getAllUsers.bind(usersController)
);

// Public routes
router.get(
  '/:username',
  optionalAuth,
  usersController.getUserProfile.bind(usersController)
);
router.get(
  '/:username/followers',
  optionalAuth,
  usersController.getFollowers.bind(usersController)
);
router.get(
  '/:username/following',
  optionalAuth,
  usersController.getFollowing.bind(usersController)
);

// Protected follow routes
router.post(
  '/:username/follow',
  authGuard,
  usersController.followUser.bind(usersController)
);
router.delete(
  '/:username/follow',
  authGuard,
  usersController.unfollowUser.bind(usersController)
);

export default router;
