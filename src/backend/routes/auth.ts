import express from 'express';
import { Request, Response } from 'express';
import authService from '../services/authService';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

// Login endpoint (GET for testing)
router.get('/login', (req: Request, res: Response) => {
  res.json({
    success: false,
    message: 'Use POST method for login',
    endpoint: '/api/auth/login',
    method: 'POST',
    required_fields: ['username', 'password']
  });
});

// Login endpoint (POST)
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password, rememberMe } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const user = await authService.authenticateUser({ username, password });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Create session with extended duration if remember me is checked
    const sessionDuration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 30 days or 24 hours
    const sessionId = await authService.createSession(
      user.id,
      req.ip,
      req.get('User-Agent'),
      rememberMe
    );

    // Set session cookie
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionDuration,
      sameSite: 'strict'
    });

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Logout endpoint
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies.session_id;
    
    if (sessionId) {
      await authService.destroySession(sessionId);
    }

    res.clearCookie('session_id');
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Test database users endpoint
router.get('/test-users', async (req: Request, res: Response) => {
  try {
    const users = await authService.getAllUsers();
    console.log('All users from database:', users);
    res.json({
      success: true,
      users: users,
      count: users.length
    });
  } catch (error) {
    console.error('Test users error:', error);
    res.status(500).json({
      success: false,
      message: 'Database error',
      error: error.message
    });
  }
});

// Check authentication status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies.session_id;
    
    if (!sessionId) {
      return res.json({
        success: true,
        authenticated: false,
        user: null
      });
    }

    const user = await authService.validateSession(sessionId);
    
    if (!user) {
      res.clearCookie('session_id');
      return res.json({
        success: true,
        authenticated: false,
        user: null
      });
    }

    res.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Register new user (admin only)
router.post('/register', authenticateUser, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { username, email, password, full_name, role } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const newUser = await authService.createUser({
      username,
      email,
      password,
      full_name,
      role: role || 'user'
    });

    res.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        full_name: newUser.full_name,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all users (admin only)
router.get('/users', authenticateUser, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const users = await authService.getAllUsers();
    
    res.json({
      success: true,
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        last_login: user.last_login
      }))
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Deactivate user (admin only)
router.post('/users/deactivate', authenticateUser, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const userId = parseInt(req.body.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    // Prevent admin from deactivating themselves
    if (userId === (req as any).user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }

    await authService.deactivateUser(userId);
    
    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Activate user (admin only)
router.post('/users/activate', authenticateUser, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const userId = parseInt(req.body.id);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    await authService.activateUser(userId);
    
    res.json({
      success: true,
      message: 'User activated successfully'
    });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Edit user (admin only)
router.put('/users/:id', authenticateUser, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const userId = parseInt(req.params.id);
    const { username, email, full_name, role } = req.body;
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    if (!username || !email) {
      return res.status(400).json({
        success: false,
        message: 'Username and email are required'
      });
    }

    await authService.updateUser(userId, { username, email, full_name, role });
    
    res.json({
      success: true,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Change user password (admin only)
router.post('/users/change-password', authenticateUser, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { userId, newPassword } = req.body;
    
    if (!userId || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'User ID and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    await authService.changeUserPassword(parseInt(userId), newPassword);
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;