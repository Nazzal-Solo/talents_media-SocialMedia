import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import passport from 'passport';
import { testConnection } from './models/db';
import {
  logger,
  securityMiddleware,
  requestLogger,
  geoCapture,
  errorHandler,
  notFound,
  generalRateLimit,
} from './middlewares';
import './middlewares/passport'; // Initialize passport strategies
import { SocketManager } from './sockets/socketManager';
import { setupSwagger } from './utils/swagger';
import { Scheduler } from './services/scheduler';
import authRoutes from './routes/auth';
import postsRoutes from './routes/posts';
import usersRoutes from './routes/users';
import commentsRoutes from './routes/comments';
import reactionsRoutes from './routes/reactions';
import reelsRoutes from './routes/reels';
import applyRoutes from './routes/apply';
import companiesRoutes from './routes/companies';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
// CORS origin configuration - allow Vite dev server and other common ports
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

// CORS handler function
const corsHandler = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  // Allow requests with no origin (like mobile apps or curl requests)
  if (!origin) return callback(null, true);

  // In development, allow any localhost origin
  if (
    process.env.NODE_ENV === 'development' &&
    origin.startsWith('http://localhost:')
  ) {
    return callback(null, true);
  }

  // In production, check against allowed origins
  if (allowedOrigins.indexOf(origin) !== -1) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
};

const io = new SocketIOServer(server, {
  cors: {
    origin: corsHandler,
    credentials: true,
  },
});

const PORT = process.env.PORT || 4002;

// Security middleware
app.use(securityMiddleware);

// CORS configuration
app.use(
  cors({
    origin: corsHandler,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'X-Requested-With',
    ],
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Passport middleware
app.use(passport.initialize());

// Request logging
app.use(requestLogger);

// Geolocation capture
app.use(geoCapture);

// Rate limiting
app.use(generalRateLimit);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Auth routes (not protected by JWT middleware)
app.use('/api/auth', authRoutes);

// Protected API routes
app.use('/api/posts', postsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/reactions', reactionsRoutes);
app.use('/api/reels', reelsRoutes);
app.use('/api/apply', applyRoutes);
logger.info('Apply routes registered at /api/apply');
app.use('/api/companies', companiesRoutes);
logger.info('Companies routes registered at /api/companies');

// Socket.IO connection handling
const socketManager = new SocketManager(io);

// Apply system scheduler
const scheduler = new Scheduler();
scheduler.start();

// Setup Swagger documentation
setupSwagger(app);

// Debug: Log all unmatched routes before 404
app.use((req, res, next) => {
  if (req.path.startsWith('/api/apply')) {
    logger.warn('Unmatched Apply route:', {
      method: req.method,
      path: req.path,
      url: req.url,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
    });
  }
  next();
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🔗 API base URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  scheduler.stop();
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

startServer();

export { app, server, io, socketManager, scheduler };
