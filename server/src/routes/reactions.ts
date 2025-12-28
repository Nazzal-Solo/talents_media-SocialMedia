import { Router } from 'express';
import { ReactionsController } from '../controllers/commentsReactionsController';
import { authGuard } from '../middlewares/auth';

const router = Router();
const reactionsController = new ReactionsController();

// Reactions routes only
router.post(
  '/post/:postId',
  authGuard,
  reactionsController.addReaction.bind(reactionsController)
);
router.post(
  '/comment/:commentId',
  authGuard,
  reactionsController.addReaction.bind(reactionsController)
);
router.delete(
  '/post/:postId',
  authGuard,
  reactionsController.removeReaction.bind(reactionsController)
);
router.delete(
  '/comment/:commentId',
  authGuard,
  reactionsController.removeReaction.bind(reactionsController)
);
router.get(
  '/post/:postId/users',
  authGuard,
  reactionsController.getReactionUsers.bind(reactionsController)
);

export default router;
