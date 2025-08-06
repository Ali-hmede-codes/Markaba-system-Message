"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authService_1 = __importDefault(require("../services/authService"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }
        const user = await authService_1.default.authenticateUser({ username, password });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }
        const sessionId = await authService_1.default.createSession(user.id, req.ip, req.get('User-Agent'));
        res.cookie('session_id', sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000,
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
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.post('/logout', async (req, res) => {
    try {
        const sessionId = req.cookies.session_id;
        if (sessionId) {
            await authService_1.default.destroySession(sessionId);
        }
        res.clearCookie('session_id');
        res.json({
            success: true,
            message: 'Logout successful'
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.get('/status', async (req, res) => {
    try {
        const sessionId = req.cookies.session_id;
        if (!sessionId) {
            return res.json({
                success: true,
                authenticated: false,
                user: null
            });
        }
        const user = await authService_1.default.validateSession(sessionId);
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
    }
    catch (error) {
        console.error('Auth status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.post('/register', auth_1.authenticateUser, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
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
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }
        const newUser = await authService_1.default.createUser({
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
    }
    catch (error) {
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
router.get('/users', auth_1.authenticateUser, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin privileges required.'
            });
        }
        const users = await authService_1.default.getAllUsers();
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
    }
    catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.post('/users/deactivate', auth_1.authenticateUser, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
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
        if (userId === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot deactivate your own account'
            });
        }
        await authService_1.default.deactivateUser(userId);
        res.json({
            success: true,
            message: 'User deactivated successfully'
        });
    }
    catch (error) {
        console.error('Deactivate user error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
exports.default = router;
