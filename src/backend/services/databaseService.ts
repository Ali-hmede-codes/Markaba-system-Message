import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
}

class DatabaseService {
  private pool: mysql.Pool | null = null;
  private config: DatabaseConfig;

  constructor() {
    this.config = {
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'administrator',
      password: process.env.DB_PASSWORD || 'Qye85pTtQhQboW2NDUA7',
      database: process.env.DB_NAME || 'markaba-messenger',
      connectionLimit: 10
    };
  }

  async initialize(): Promise<void> {
    try {
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        waitForConnections: true,
        connectionLimit: this.config.connectionLimit,
        queueLimit: 0,
        charset: 'utf8mb4'
      });

      // Test the connection
      const connection = await this.pool.getConnection();
      console.log('✓ Database connected successfully');
      connection.release();
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  async query(sql: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  // Test database connection
  async testConnection(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    
    const connection = await this.pool.getConnection();
    try {
      await connection.ping();
    } finally {
      connection.release();
    }
  }

  async getConnection(): Promise<mysql.PoolConnection> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }
    return await this.pool.getConnection();
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('Database connection closed');
    }
  }

  isConnected(): boolean {
    return this.pool !== null;
  }

  getConfig() {
    return {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user
    };
  }
}

export default new DatabaseService();