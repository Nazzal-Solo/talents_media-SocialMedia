"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduler = exports.socketManager = exports.io = exports.server = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const passport_1 = __importDefault(require("passport"));
const db_1 = require("./models/db");
const middlewares_1 = require("./middlewares");
require("./middlewares/passport");
const socketManager_1 = require("./sockets/socketManager");
const swagger_1 = require("./utils/swagger");
const scheduler_1 = require("./services/scheduler");
const auth_1 = __importDefault(require("./routes/auth"));
const posts_1 = __importDefault(require("./routes/posts"));
const users_1 = __importDefault(require("./routes/users"));
const comments_1 = __importDefault(require("./routes/comments"));
const reactions_1 = __importDefault(require("./routes/reactions"));
const reels_1 = __importDefault(require("./routes/reels"));
const apply_1 = __importDefault(require("./routes/apply"));
dotenv_1.default.config();
const app = (0, express_1.default)();
exports.app = app;
const server = (0, http_1.createServer)(app);
exports.server = server;
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : process.env.WEB_URL
        ? [process.env.WEB_URL]
        : [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:5175',
            'http://localhost:5176',
        ];
const corsHandler = (origin, callback) => {
    if (!origin)
        return callback(null, true);
    if (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost:')) {
        return callback(null, true);
    }
    if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
    }
    else {
        callback(new Error('Not allowed by CORS'));
    }
};
const io = new socket_io_1.Server(server, {
    cors: {
        origin: corsHandler,
        credentials: true,
    },
});
exports.io = io;
const PORT = process.env.PORT || 4002;
app.use(middlewares_1.securityMiddleware);
app.use((0, cors_1.default)({
    origin: corsHandler,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
app.use(passport_1.default.initialize());
app.use(middlewares_1.requestLogger);
app.use(middlewares_1.geoCapture);
app.use(middlewares_1.generalRateLimit);
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
app.use('/api/auth', auth_1.default);
app.use('/api/posts', posts_1.default);
app.use('/api/users', users_1.default);
app.use('/api/comments', comments_1.default);
app.use('/api/reactions', reactions_1.default);
app.use('/api/reels', reels_1.default);
app.use('/api/apply', apply_1.default);
middlewares_1.logger.info('Apply routes registered at /api/apply');
const socketManager = new socketManager_1.SocketManager(io);
exports.socketManager = socketManager;
const scheduler = new scheduler_1.Scheduler();
exports.scheduler = scheduler;
scheduler.start();
(0, swagger_1.setupSwagger)(app);
app.use((req, res, next) => {
    if (req.path.startsWith('/api/apply')) {
        middlewares_1.logger.warn('Unmatched Apply route:', { method: req.method, path: req.path, url: req.url });
    }
    next();
});
app.use(middlewares_1.notFound);
app.use(middlewares_1.errorHandler);
const startServer = async () => {
    try {
        await (0, db_1.testConnection)();
        server.listen(PORT, () => {
            middlewares_1.logger.info(`🚀 Server running on port ${PORT}`);
            middlewares_1.logger.info(`📊 Health check: http://localhost:${PORT}/health`);
            middlewares_1.logger.info(`🔗 API base URL: http://localhost:${PORT}/api`);
        });
    }
    catch (error) {
        middlewares_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
process.on('SIGTERM', () => {
    middlewares_1.logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        middlewares_1.logger.info('Process terminated');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    middlewares_1.logger.info('SIGINT received, shutting down gracefully');
    scheduler.stop();
    server.close(() => {
        middlewares_1.logger.info('Process terminated');
        process.exit(0);
    });
});
startServer();
//# sourceMappingURL=server.js.map