"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reelsController_1 = require("../controllers/reelsController");
const auth_1 = require("../middlewares/auth");
const middlewares_1 = require("../middlewares");
const router = (0, express_1.Router)();
const reelsController = new reelsController_1.ReelsController();
router.get('/', reelsController.getReels.bind(reelsController));
router.get('/:id', auth_1.optionalAuth, reelsController.getReel.bind(reelsController));
router.get('/user/:username', auth_1.optionalAuth, reelsController.getUserReels.bind(reelsController));
router.post('/:id/view', auth_1.optionalAuth, reelsController.incrementViews.bind(reelsController));
router.post('/', auth_1.authGuard, middlewares_1.generalRateLimit, reelsController.createReel.bind(reelsController));
router.patch('/:id', auth_1.authGuard, reelsController.updateReel.bind(reelsController));
router.delete('/:id', auth_1.authGuard, reelsController.deleteReel.bind(reelsController));
exports.default = router;
//# sourceMappingURL=reels.js.map