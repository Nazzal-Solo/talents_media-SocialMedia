import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pino from 'pino';
import { query } from '../models/db';

// Logger setup
export const logger = pino({
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

// Rate limiting
export const createRateLimit = (windowMs: number, max: number, message?: string) =>
  rateLimit({
    windowMs,
    max,
    message: message || 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

// Rate limits - more lenient in development
const isDevelopment = process.env.NODE_ENV === 'development';

export const authRateLimit = createRateLimit(
  15 * 60 * 1000, 
  isDevelopment ? 100 : 10,  // Increased to prevent legitimate refresh loops
  'Too many authentication attempts'
);
export const generalRateLimit = createRateLimit(
  15 * 60 * 1000, 
  isDevelopment ? 5000 : 100  // Increased dev limit to 5000 requests per 15 minutes
);
export const strictRateLimit = createRateLimit(
  15 * 60 * 1000, 
  isDevelopment ? 200 : 20
);

// Security middleware
export const securityMiddleware = [
  helmet({
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
  // CORS is handled in server.ts with more flexible configuration
];

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
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

// Geolocation middleware
export const geoCapture = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    
    // Skip geolocation for localhost
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
      req.geo = { country: 'US', city: 'Local', ip: ip };
      next();
      return;
    }

    // Try to get geolocation from ipapi.co
    try {
      const response = await fetch(`https://ipapi.co/${ip}/json/`);
      const data = await response.json() as any;
      
      if (data.error) {
        throw new Error(data.reason);
      }
      
      req.geo = {
        country: data.country_name || 'Unknown',
        city: data.city || 'Unknown',
        ip: ip
      };
    } catch (error) {
      // Fallback to ipwho.is
      try {
        const response = await fetch(`http://ipwho.is/${ip}`);
        const data = await response.json() as any;
        
        req.geo = {
          country: data.country || 'Unknown',
          city: data.city || 'Unknown',
          ip: ip
        };
      } catch (fallbackError) {
        // Default values if both services fail
        req.geo = {
          country: 'Unknown',
          city: 'Unknown',
          ip: ip
        };
      }
    }
    
    next();
  } catch (error) {
    logger.warn('Geolocation capture failed:', error);
    req.geo = { country: 'Unknown', city: 'Unknown', ip: req.ip || '127.0.0.1' };
    next();
  }
};

// Error handling middleware
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error({
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

// Not found middleware
export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({ error: 'Route not found' });
};

// Extend Request interface for geolocation
declare global {
  namespace Express {
    interface Request {
      geo?: {
        country: string;
        city: string;
        ip: string;
      };
    }
  }
}
