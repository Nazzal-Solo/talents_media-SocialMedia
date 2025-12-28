import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromRequest, JWTPayload } from '../utils/jwt';
import { query } from '../models/db';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export const authGuard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromRequest(req);
    
    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const payload = verifyAccessToken(token);
    
    // Verify user still exists and is active
    const result = await query(
      'SELECT id, email, username, role FROM users WHERE id = $1',
      [payload.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    (req as any).user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid access token' });
  }
};

export const adminGuard = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromRequest(req);
    
    if (token) {
      const payload = verifyAccessToken(token);
      
      const result = await query(
        'SELECT id, email, username, role FROM users WHERE id = $1',
        [payload.userId]
      );

      if (result.rows.length > 0) {
        (req as any).user = payload;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};
