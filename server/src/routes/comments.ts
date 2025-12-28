import { Router } from 'express';
import { CommentsController } from '../controllers/commentsReactionsController';
import { authGuard, optionalAuth } from '../middlewares/auth';
import { generalRateLimit } from '../middlewares';

const router = Router();
const commentsController = new CommentsController();

// Comments routes only
router.get(
  '/post/:postId',
  optionalAuth,
  commentsController.getPostComments.bind(commentsController)
);
router.post(
  '/post/:postId',
  authGuard,
  generalRateLimit,
  commentsController.createComment.bind(commentsController)
);
router.delete(
  '/:id',
  authGuard,
  commentsController.deleteComment.bind(commentsController)
);

export default router;
