"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class DatabaseService {
    pool = null;
    config;
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
    async initialize() {
        try {
            this.pool = promise_1.default.createPool({
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
            const connection = await this.pool.getConnection();
            console.log('✓ Database connected successfully');
            connection.release();
        }
        catch (error) {
            console.error('Database connection failed:', error);
            throw error;
        }
    }
    async query(sql, params) {
        if (!this.pool) {
            throw new Error('Database not initialized');
        }
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        }
        catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }
    async testConnection() {
        if (!this.pool) {
            throw new Error('Database not initialized');
        }
        const connection = await this.pool.getConnection();
        try {
            await connection.ping();
        }
        finally {
            connection.release();
        }
    }
    async getConnection() {
        if (!this.pool) {
            throw new Error('Database not initialized');
        }
        return await this.pool.getConnection();
    }
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            console.log('Database connection closed');
        }
    }
    isConnected() {
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
exports.default = new DatabaseService();
