import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { Request, Response, NextFunction } from 'express';

// Properly type the User interface
interface IUserDocument {
  _id: any;
  email: string;
  subscription: {
    tier: string;
    status: string;
  };
  trainer?: {
    isTrainer: boolean;
  };
  lastActive: Date;
  emailVerified: boolean;
  save(): Promise<any>;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
      token?: string;
      group?: any;
    }
  }
}

// Basic authentication middleware
export const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error();
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify token
    const decoded: any = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    );

    // Find user
    const user = await User.findById(decoded._id);

    if (!user) {
      throw new Error();
    }

    // Update last active
    user.lastActive = new Date();
    await user.save();

    // Attach user and token to request
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Please authenticate'
    });
  }
};

// Check if user is an active client (premium tier)
export const requireActiveClient = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.subscription.tier !== 'active-client') {
      return res.status(403).json({
        success: false,
        message: 'This feature requires an Active Client subscription'
      });
    }

    if (req.user.subscription.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your subscription is not active'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking subscription status'
    });
  }
};

// Check if user is a trainer
export const requireTrainer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!req.user.trainer?.isTrainer) {
      return res.status(403).json({
        success: false,
        message: 'This action requires trainer privileges'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking trainer status'
    });
  }
};

// Check if user is admin (you as the main trainer)
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user is the main admin (you can set this via environment variable)
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',');
    
    if (!adminEmails.includes(req.user.email)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking admin status'
    });
  }
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    
    const decoded: any = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    );

    const user = await User.findById(decoded._id);

    if (user) {
      user.lastActive = new Date();
      await user.save();
      req.user = user;
      req.token = token;
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Check if user has verified email
export const requireVerifiedEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!req.user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address to access this feature'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking email verification status'
    });
  }
};

// Rate limiting per user
export const userRateLimit = (
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
) => {
  const requests = new Map();

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const now = Date.now();
    const userRequests = requests.get(userId) || [];

    // Remove old requests outside the window
    const validRequests = userRequests.filter(
      (timestamp: number) => now - timestamp < windowMs
    );

    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.'
      });
    }

    validRequests.push(now);
    requests.set(userId, validRequests);

    next();
  };
};

// Validate request body
export const validateBody = (requiredFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    next();
  };
};

// Check group membership
export const requireGroupMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { groupId } = req.params;
    
    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID required'
      });
    }

    const Group = require('../models/Group').default;
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!group.isMember(req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'You must be a member of this group'
      });
    }

    // Attach group to request for use in route handler
    (req as any).group = group;

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking group membership'
    });
  }
};

// Check group admin
export const requireGroupAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { groupId } = req.params;
    
    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID required'
      });
    }

    const Group = require('../models/Group').default;
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!group.isAdmin(req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required for this action'
      });
    }

    // Attach group to request for use in route handler
    (req as any).group = group;

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking admin status'
    });
  }
};