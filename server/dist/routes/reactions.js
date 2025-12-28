"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const commentsReactionsController_1 = require("../controllers/commentsReactionsController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const reactionsController = new commentsReactionsController_1.ReactionsController();
router.post('/post/:postId', auth_1.authGuard, reactionsController.addReaction.bind(reactionsController));
router.post('/comment/:commentId', auth_1.authGuard, reactionsController.addReaction.bind(reactionsController));
router.delete('/post/:postId', auth_1.authGuard, reactionsController.removeReaction.bind(reactionsController));
router.delete('/comment/:commentId', auth_1.authGuard, reactionsController.removeReaction.bind(reactionsController));
router.get('/post/:postId/users', auth_1.authGuard, reactionsController.getReactionUsers.bind(reactionsController));
exports.default = router;
//# sourceMappingURL=reactions.js.map