"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.checkAuth = exports.requireAdmin = exports.authenticateUser = void 0;
const authService_1 = __importDefault(require("../services/authService"));
const authenticateUser = async (req, res, next) => {
    try {
        const sessionId = req.cookies.session_id;
        if (!sessionId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                redirect: '/login'
            });
        }
        const user = await authService_1.default.validateSession(sessionId);
        if (!user) {
            res.clearCookie('session_id');
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired session',
                redirect: '/login'
            });
        }
        req.user = user;
        next();
    }
    catch (error) {
        console.error('Authentication middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
exports.authenticateUser = authenticateUser;
const requireAdmin = (req, res, next) => {
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
exports.requireAdmin = requireAdmin;
const checkAuth = async (req, res, next) => {
    try {
        const sessionId = req.cookies.session_id;
        if (!sessionId) {
            return res.redirect('/login');
        }
        const user = await authService_1.default.validateSession(sessionId);
        if (!user) {
            res.clearCookie('session_id');
            return res.redirect('/login');
        }
        req.user = user;
        next();
    }
    catch (error) {
        console.error('Check auth middleware error:', error);
        res.redirect('/login');
    }
};
exports.checkAuth = checkAuth;
const optionalAuth = async (req, res, next) => {
    try {
        const sessionId = req.cookies.session_id;
        if (sessionId) {
            const user = await authService_1.default.validateSession(sessionId);
            if (user) {
                req.user = user;
            }
            else {
                res.clearCookie('session_id');
            }
        }
        next();
    }
    catch (error) {
        console.error('Optional auth middleware error:', error);
        next();
    }
};
exports.optionalAuth = optionalAuth;
