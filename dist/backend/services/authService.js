"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const uuid_1 = require("uuid");
const databaseService_1 = __importDefault(require("./databaseService"));
class AuthService {
    saltRounds = 12;
    sessionDuration = 24 * 60 * 60 * 1000;
    async hashPassword(password) {
        return await bcrypt_1.default.hash(password, this.saltRounds);
    }
    async verifyPassword(password, hash) {
        return await bcrypt_1.default.compare(password, hash);
    }
    async findUserByUsername(username) {
        try {
            const sql = `
        SELECT id, username, email, password_hash, full_name, role, is_active, created_at, last_login
        FROM users 
        WHERE username = ? AND is_active = 1
      `;
            const users = await databaseService_1.default.query(sql, [username]);
            return users.length > 0 ? users[0] : null;
        }
        catch (error) {
            console.error('Error finding user by username:', error);
            throw error;
        }
    }
    async findUserById(id) {
        try {
            const sql = `
        SELECT id, username, email, full_name, role, is_active, created_at, last_login
        FROM users 
        WHERE id = ? AND is_active = 1
      `;
            const users = await databaseService_1.default.query(sql, [id]);
            return users.length > 0 ? users[0] : null;
        }
        catch (error) {
            console.error('Error finding user by ID:', error);
            throw error;
        }
    }
    async authenticateUser(credentials) {
        try {
            const sql = `
        SELECT id, username, email, password_hash, full_name, role, is_active, created_at, last_login
        FROM users 
        WHERE username = ? AND is_active = 1
      `;
            const users = await databaseService_1.default.query(sql, [credentials.username]);
            if (users.length === 0) {
                return null;
            }
            const user = users[0];
            const isValidPassword = await this.verifyPassword(credentials.password, user.password_hash);
            if (!isValidPassword) {
                return null;
            }
            await this.updateLastLogin(user.id);
            const { password_hash, ...userWithoutPassword } = user;
            return userWithoutPassword;
        }
        catch (error) {
            console.error('Error authenticating user:', error);
            throw error;
        }
    }
    async createUser(userData) {
        try {
            const existingUser = await databaseService_1.default.query('SELECT id FROM users WHERE username = ? OR email = ?', [userData.username, userData.email]);
            if (existingUser.length > 0) {
                throw new Error('Username or email already exists');
            }
            const hashedPassword = await this.hashPassword(userData.password);
            const sql = `
        INSERT INTO users (username, email, password_hash, full_name, role, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `;
            const result = await databaseService_1.default.query(sql, [
                userData.username,
                userData.email,
                hashedPassword,
                userData.full_name,
                userData.role || 'user'
            ]);
            const newUser = await this.findUserById(result.insertId);
            if (!newUser) {
                throw new Error('Failed to create user');
            }
            return newUser;
        }
        catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }
    async createSession(userId, ipAddress, userAgent) {
        try {
            const sessionId = (0, uuid_1.v4)();
            const expiresAt = new Date(Date.now() + this.sessionDuration);
            const sql = `
        INSERT INTO user_sessions (session_id, user_id, ip_address, user_agent, expires_at, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `;
            await databaseService_1.default.query(sql, [sessionId, userId, ipAddress, userAgent, expiresAt]);
            return sessionId;
        }
        catch (error) {
            console.error('Error creating session:', error);
            throw error;
        }
    }
    async validateSession(sessionId) {
        try {
            const sql = `
        SELECT u.id, u.username, u.email, u.full_name, u.role, u.is_active, u.created_at, u.last_login
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_id = ? AND s.is_active = 1 AND s.expires_at > NOW() AND u.is_active = 1
      `;
            const users = await databaseService_1.default.query(sql, [sessionId]);
            return users.length > 0 ? users[0] : null;
        }
        catch (error) {
            console.error('Error validating session:', error);
            throw error;
        }
    }
    async destroySession(sessionId) {
        try {
            const sql = 'UPDATE user_sessions SET is_active = 0 WHERE session_id = ?';
            await databaseService_1.default.query(sql, [sessionId]);
        }
        catch (error) {
            console.error('Error destroying session:', error);
            throw error;
        }
    }
    async destroyAllUserSessions(userId) {
        try {
            const sql = 'UPDATE user_sessions SET is_active = 0 WHERE user_id = ?';
            await databaseService_1.default.query(sql, [userId]);
        }
        catch (error) {
            console.error('Error destroying all user sessions:', error);
            throw error;
        }
    }
    async cleanupExpiredSessions() {
        try {
            const sql = 'DELETE FROM user_sessions WHERE expires_at < NOW() OR is_active = 0';
            await databaseService_1.default.query(sql);
        }
        catch (error) {
            console.error('Error cleaning up expired sessions:', error);
            throw error;
        }
    }
    async updateLastLogin(userId) {
        try {
            const sql = 'UPDATE users SET last_login = NOW() WHERE id = ?';
            await databaseService_1.default.query(sql, [userId]);
        }
        catch (error) {
            console.error('Error updating last login:', error);
        }
    }
    async getAllUsers() {
        try {
            const sql = `
        SELECT id, username, email, full_name, role, is_active, created_at, last_login
        FROM users 
        ORDER BY created_at DESC
      `;
            return await databaseService_1.default.query(sql);
        }
        catch (error) {
            console.error('Error getting all users:', error);
            throw error;
        }
    }
    async deactivateUser(userId) {
        try {
            const sql = 'UPDATE users SET is_active = 0 WHERE id = ?';
            await databaseService_1.default.query(sql, [userId]);
            await this.destroyAllUserSessions(userId);
        }
        catch (error) {
            console.error('Error deactivating user:', error);
            throw error;
        }
    }
}
exports.default = new AuthService();
