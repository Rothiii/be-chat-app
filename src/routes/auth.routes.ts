import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { syncUserToDatabase, authenticate } from '../lib/auth';

const router = Router();

/**
 * POST /auth/signup
 * Register a new user with email and password
 */
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username || email.split('@')[0],
        },
      },
    });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (!data.user) {
      res.status(400).json({ error: 'Failed to create user' });
      return;
    }

    // Sync user to database (don't block auth if this fails)
    const syncSuccess = await syncUserToDatabase(data.user.id, email, username);
    if (!syncSuccess) {
      console.warn('Failed to sync user to database, but auth succeeded');
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        username: username || email.split('@')[0],
      },
      session: data.session,
    });
  } catch (error: any) {
    console.error('Signup error:', error);

    // Send proper error response
    const errorMessage = error?.message || 'Internal server error';
    res.status(500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

/**
 * POST /auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      res.status(401).json({ error: error.message });
      return;
    }

    if (!data.user || !data.session) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Sync user to database (in case they were created before)
    await syncUserToDatabase(data.user.id, email);

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      session: data.session,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/logout
 * Logout current user
 */
router.post('/logout', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7); // Remove 'Bearer ' prefix

    if (token) {
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }
    }

    res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /auth/me
 * Get current user information
 */
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    res.status(200).json({
      user: req.user,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error) {
      res.status(401).json({ error: error.message });
      return;
    }

    res.status(200).json({
      message: 'Token refreshed successfully',
      session: data.session,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
