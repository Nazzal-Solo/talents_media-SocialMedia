"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const commentsReactionsController_1 = require("../controllers/commentsReactionsController");
const auth_1 = require("../middlewares/auth");
const middlewares_1 = require("../middlewares");
const router = (0, express_1.Router)();
const commentsController = new commentsReactionsController_1.CommentsController();
router.get('/post/:postId', auth_1.optionalAuth, commentsController.getPostComments.bind(commentsController));
router.post('/post/:postId', auth_1.authGuard, middlewares_1.generalRateLimit, commentsController.createComment.bind(commentsController));
router.delete('/:id', auth_1.authGuard, commentsController.deleteComment.bind(commentsController));
exports.default = router;
//# sourceMappingURL=comments.js.map