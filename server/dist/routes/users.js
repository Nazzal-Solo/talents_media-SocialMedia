"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const usersController_1 = require("../controllers/usersController");
const auth_1 = require("../middlewares/auth");
const middlewares_1 = require("../middlewares");
const router = (0, express_1.Router)();
const usersController = new usersController_1.UsersController();
router.get('/me', auth_1.authGuard, usersController.getMe.bind(usersController));
router.patch('/me', auth_1.authGuard, middlewares_1.generalRateLimit, usersController.updateProfile.bind(usersController));
router.get('/search', auth_1.optionalAuth, usersController.searchUsers.bind(usersController));
router.get('/all', auth_1.optionalAuth, usersController.getAllUsers.bind(usersController));
router.get('/:username', auth_1.optionalAuth, usersController.getUserProfile.bind(usersController));
router.get('/:username/followers', auth_1.optionalAuth, usersController.getFollowers.bind(usersController));
router.get('/:username/following', auth_1.optionalAuth, usersController.getFollowing.bind(usersController));
router.post('/:username/follow', auth_1.authGuard, usersController.followUser.bind(usersController));
router.delete('/:username/follow', auth_1.authGuard, usersController.unfollowUser.bind(usersController));
exports.default = router;
//# sourceMappingURL=users.js.map