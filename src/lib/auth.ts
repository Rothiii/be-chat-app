import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from './supabase';
import { db } from './db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role?: string;
      };
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token from Supabase and attaches user to request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No authorization token provided' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email!,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is present, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

      if (!error && user) {
        req.user = {
          id: user.id,
          email: user.email!,
          role: user.role,
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication on error
    next();
  }
};

/**
 * Sync Supabase user to database
 */
export const syncUserToDatabase = async (userId: string, email: string, username?: string) => {
  try {
    // Check if user exists by ID or email
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (existingUser) {
      // User already exists, just return success
      return true;
    }

    // Check if email already exists (different user)
    const existingEmail = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingEmail) {
      // Email already exists with different ID, this shouldn't happen
      // but we'll just return true to avoid blocking the auth flow
      console.warn(`Email ${email} already exists with different user ID`);
      return true;
    }

    // Create new user
    await db.insert(users).values({
      id: userId,
      email,
      username: username || email.split('@')[0],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return true;
  } catch (error) {
    console.error('Error syncing user to database:', error);
    // Return false instead of throwing to allow auth to continue
    return false;
  }
};
