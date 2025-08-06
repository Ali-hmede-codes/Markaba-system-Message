import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        email: string;
        full_name: string;
        role: 'admin' | 'user';
        is_active: boolean;
        created_at: Date;
        last_login?: Date;
      };
    }
  }
}

// Middleware to authenticate user
export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.cookies.session_id;
    
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        redirect: '/login'
      });
    }

    const user = await authService.validateSession(sessionId);
    
    if (!user) {
      res.clearCookie('session_id');
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session',
        redirect: '/login'
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Middleware to require admin role
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin privileges required'
    });
  }

  next();
};

// Middleware to check if user is authenticated (for frontend routes)
export const checkAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.cookies.session_id;
    
    if (!sessionId) {
      return res.redirect('/login');
    }

    const user = await authService.validateSession(sessionId);
    
    if (!user) {
      res.clearCookie('session_id');
      return res.redirect('/login');
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Check auth middleware error:', error);
    res.redirect('/login');
  }
};

// Optional authentication middleware (doesn't redirect if not authenticated)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.cookies.session_id;
    
    if (sessionId) {
      const user = await authService.validateSession(sessionId);
      if (user) {
        req.user = user;
      } else {
        res.clearCookie('session_id');
      }
    }
    
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
};