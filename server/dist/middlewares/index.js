"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = exports.errorHandler = exports.geoCapture = exports.requestLogger = exports.securityMiddleware = exports.strictRateLimit = exports.generalRateLimit = exports.authRateLimit = exports.createRateLimit = exports.logger = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const pino_1 = __importDefault(require("pino"));
exports.logger = (0, pino_1.default)({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    } : undefined
});
const createRateLimit = (windowMs, max, message) => (0, express_rate_limit_1.default)({
    windowMs,
    max,
    message: message || 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
exports.createRateLimit = createRateLimit;
const isDevelopment = process.env.NODE_ENV === 'development';
exports.authRateLimit = (0, exports.createRateLimit)(15 * 60 * 1000, isDevelopment ? 50 : 5, 'Too many authentication attempts');
exports.generalRateLimit = (0, exports.createRateLimit)(15 * 60 * 1000, isDevelopment ? 1000 : 100);
exports.strictRateLimit = (0, exports.createRateLimit)(15 * 60 * 1000, isDevelopment ? 200 : 20);
exports.securityMiddleware = [
    (0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "https:", "http:"],
                scriptSrc: ["'self'"],
                connectSrc: ["'self'", "https://api.emailjs.com"],
            },
        },
    }),
];
const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        exports.logger.info({
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    });
    next();
};
exports.requestLogger = requestLogger;
const geoCapture = async (req, res, next) => {
    try {
        const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
        if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
            req.geo = { country: 'US', city: 'Local', ip: ip };
            next();
            return;
        }
        try {
            const response = await fetch(`https://ipapi.co/${ip}/json/`);
            const data = await response.json();
            if (data.error) {
                throw new Error(data.reason);
            }
            req.geo = {
                country: data.country_name || 'Unknown',
                city: data.city || 'Unknown',
                ip: ip
            };
        }
        catch (error) {
            try {
                const response = await fetch(`http://ipwho.is/${ip}`);
                const data = await response.json();
                req.geo = {
                    country: data.country || 'Unknown',
                    city: data.city || 'Unknown',
                    ip: ip
                };
            }
            catch (fallbackError) {
                req.geo = {
                    country: 'Unknown',
                    city: 'Unknown',
                    ip: ip
                };
            }
        }
        next();
    }
    catch (error) {
        exports.logger.warn('Geolocation capture failed:', error);
        req.geo = { country: 'Unknown', city: 'Unknown', ip: req.ip || '127.0.0.1' };
        next();
    }
};
exports.geoCapture = geoCapture;
const errorHandler = (error, req, res, next) => {
    exports.logger.error({
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
    });
    if (res.headersSent) {
        return next(error);
    }
    const statusCode = res.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error.message;
    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
};
exports.errorHandler = errorHandler;
const notFound = (req, res) => {
    res.status(404).json({ error: 'Route not found' });
};
exports.notFound = notFound;
//# sourceMappingURL=index.js.map