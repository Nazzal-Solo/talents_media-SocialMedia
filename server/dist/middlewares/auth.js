"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.adminGuard = exports.authGuard = void 0;
const jwt_1 = require("../utils/jwt");
const db_1 = require("../models/db");
const authGuard = async (req, res, next) => {
    try {
        const token = (0, jwt_1.extractTokenFromRequest)(req);
        if (!token) {
            res.status(401).json({ error: 'Access token required' });
            return;
        }
        const payload = (0, jwt_1.verifyAccessToken)(token);
        const result = await (0, db_1.query)('SELECT id, email, username, role FROM users WHERE id = $1', [payload.userId]);
        if (result.rows.length === 0) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        req.user = payload;
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Invalid access token' });
    }
};
exports.authGuard = authGuard;
const adminGuard = (req, res, next) => {
    const user = req.user;
    if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
    }
    next();
};
exports.adminGuard = adminGuard;
const optionalAuth = async (req, res, next) => {
    try {
        const token = (0, jwt_1.extractTokenFromRequest)(req);
        if (token) {
            const payload = (0, jwt_1.verifyAccessToken)(token);
            const result = await (0, db_1.query)('SELECT id, email, username, role FROM users WHERE id = $1', [payload.userId]);
            if (result.rows.length > 0) {
                req.user = payload;
            }
        }
        next();
    }
    catch (error) {
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map