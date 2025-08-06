import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import databaseService from './databaseService';

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: Date;
  last_login?: Date;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role?: 'admin' | 'user';
}

interface UserSession {
  session_id: string;
  user_id: number;
  ip_address?: string;
  user_agent?: string;
  expires_at: Date;
}

class AuthService {
  private saltRounds = 12;
  private sessionDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.saltRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  async findUserByUsername(username: string): Promise<User | null> {
    try {
      const sql = `
        SELECT id, username, email, password_hash, full_name, role, is_active, created_at, last_login
        FROM users 
        WHERE username = ? AND is_active = 1
      `;
      const users = await databaseService.query(sql, [username]);
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error finding user by username:', error);
      throw error;
    }
  }

  async findUserById(id: number): Promise<User | null> {
    try {
      const sql = `
        SELECT id, username, email, full_name, role, is_active, created_at, last_login
        FROM users 
        WHERE id = ? AND is_active = 1
      `;
      const users = await databaseService.query(sql, [id]);
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  async authenticateUser(credentials: LoginCredentials): Promise<User | null> {
    try {
      const sql = `
        SELECT id, username, email, password_hash, full_name, role, is_active, created_at, last_login
        FROM users 
        WHERE username = ? AND is_active = 1
      `;
      const users = await databaseService.query(sql, [credentials.username]);
      
      if (users.length === 0) {
        return null;
      }

      const user = users[0];
      const isValidPassword = await this.verifyPassword(credentials.password, user.password_hash);
      
      if (!isValidPassword) {
        return null;
      }

      // Update last login
      await this.updateLastLogin(user.id);

      // Remove password_hash from returned user object
      const { password_hash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      console.error('Error authenticating user:', error);
      throw error;
    }
  }

  async createUser(userData: RegisterData): Promise<User> {
    try {
      // Check if username or email already exists
      const existingUser = await databaseService.query(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [userData.username, userData.email]
      );

      if (existingUser.length > 0) {
        throw new Error('Username or email already exists');
      }

      const hashedPassword = await this.hashPassword(userData.password);
      
      const sql = `
        INSERT INTO users (username, email, password_hash, full_name, role, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `;
      
      const result = await databaseService.query(sql, [
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
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async createSession(userId: number, ipAddress?: string, userAgent?: string, rememberMe?: boolean): Promise<string> {
    try {
      const sessionId = uuidv4();
      const sessionDuration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : this.sessionDuration; // 30 days or 24 hours
      const expiresAt = new Date(Date.now() + sessionDuration);

      const sql = `
        INSERT INTO user_sessions (session_id, user_id, ip_address, user_agent, expires_at, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `;

      await databaseService.query(sql, [sessionId, userId, ipAddress, userAgent, expiresAt]);
      return sessionId;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  async validateSession(sessionId: string): Promise<User | null> {
    try {
      const sql = `
        SELECT u.id, u.username, u.email, u.full_name, u.role, u.is_active, u.created_at, u.last_login
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_id = ? AND s.is_active = 1 AND s.expires_at > NOW() AND u.is_active = 1
      `;

      const users = await databaseService.query(sql, [sessionId]);
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      console.error('Error validating session:', error);
      throw error;
    }
  }

  async destroySession(sessionId: string): Promise<void> {
    try {
      const sql = 'UPDATE user_sessions SET is_active = 0 WHERE session_id = ?';
      await databaseService.query(sql, [sessionId]);
    } catch (error) {
      console.error('Error destroying session:', error);
      throw error;
    }
  }

  async destroyAllUserSessions(userId: number): Promise<void> {
    try {
      const sql = 'UPDATE user_sessions SET is_active = 0 WHERE user_id = ?';
      await databaseService.query(sql, [userId]);
    } catch (error) {
      console.error('Error destroying all user sessions:', error);
      throw error;
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      const sql = 'DELETE FROM user_sessions WHERE expires_at < NOW() OR is_active = 0';
      await databaseService.query(sql);
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      throw error;
    }
  }

  private async updateLastLogin(userId: number): Promise<void> {
    try {
      const sql = 'UPDATE users SET last_login = NOW() WHERE id = ?';
      await databaseService.query(sql, [userId]);
    } catch (error) {
      console.error('Error updating last login:', error);
      // Don't throw error for this non-critical operation
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const sql = `
        SELECT id, username, email, full_name, role, is_active, created_at, last_login
        FROM users 
        ORDER BY created_at DESC
      `;
      return await databaseService.query(sql);
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }

  async deactivateUser(userId: number): Promise<void> {
    try {
      const sql = 'UPDATE users SET is_active = 0 WHERE id = ?';
      await databaseService.query(sql, [userId]);
      
      // Also destroy all sessions for this user
      await this.destroyAllUserSessions(userId);
    } catch (error) {
      console.error('Error deactivating user:', error);
      throw error;
    }
  }

  async activateUser(userId: number): Promise<void> {
    try {
      await databaseService.query(
        'UPDATE users SET is_active = 1 WHERE id = ?',
        [userId]
      );
    } catch (error) {
      console.error('Error activating user:', error);
      throw new Error('Failed to activate user');
    }
  }

  async updateUser(userId: number, userData: { username?: string; email?: string; full_name?: string; role?: string }): Promise<void> {
    try {
      const { username, email, full_name, role } = userData;
      await databaseService.query(
        'UPDATE users SET username = ?, email = ?, full_name = ?, role = ? WHERE id = ?',
        [username, email, full_name, role, userId]
      );
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  }

  async changeUserPassword(userId: number, newPassword: string): Promise<void> {
    try {
      const hashedPassword = await this.hashPassword(newPassword);
      await databaseService.query(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [hashedPassword, userId]
      );
    } catch (error) {
      console.error('Error changing user password:', error);
      throw new Error('Failed to change user password');
    }
  }
}

export default new AuthService();