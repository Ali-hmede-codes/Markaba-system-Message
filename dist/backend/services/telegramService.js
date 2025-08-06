"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
class TelegramService extends events_1.EventEmitter {
    config;
    bot;
    isConnected = false;
    constructor() {
        super();
        this.config = {
            botToken: process.env.TELEGRAM_BOT_TOKEN || '',
            channelId: process.env.TELEGRAM_CHANNEL_ID || '',
            userId: parseInt(process.env.TELEGRAM_USER_ID || '0')
        };
        if (!this.config.botToken) {
            throw new Error('TELEGRAM_BOT_TOKEN is not configured in environment variables');
        }
        this.bot = new node_telegram_bot_api_1.default(this.config.botToken, { polling: false });
    }
    async initialize() {
        try {
            if (!this.config.channelId) {
                throw new Error('TELEGRAM_CHANNEL_ID is not configured in environment variables');
            }
            const botInfo = await this.bot.getMe();
            this.isConnected = true;
            console.log('✓ Telegram bot connected:', botInfo.username);
            console.log('✓ Telegram channel ID:', this.config.channelId);
            this.emit('connected', true);
        }
        catch (error) {
            console.error('Telegram connection error:', error);
            this.isConnected = false;
            this.emit('connected', false);
            throw error;
        }
    }
    async sendMessage(text) {
        try {
            if (!this.isConnected) {
                throw new Error('Telegram bot is not connected. Please initialize first.');
            }
            const message = await this.bot.sendMessage(this.config.channelId, text, {
                parse_mode: 'HTML'
            });
            console.log('✓ Message sent to Telegram channel');
            return { success: true, messageId: message.message_id };
        }
        catch (error) {
            console.error('Error sending Telegram message:', error);
            throw error;
        }
    }
    async sendPhoto(photoBuffer, caption, fileName) {
        try {
            if (!this.isConnected) {
                throw new Error('Telegram bot is not connected. Please initialize first.');
            }
            const message = await this.bot.sendPhoto(this.config.channelId, photoBuffer, {
                caption: caption,
                parse_mode: 'HTML'
            });
            console.log('✓ Photo sent to Telegram channel');
            return { success: true, messageId: message.message_id };
        }
        catch (error) {
            console.error('Error sending Telegram photo:', error);
            throw error;
        }
    }
    async sendVideo(videoBuffer, caption, fileName) {
        try {
            if (!this.isConnected) {
                throw new Error('Telegram bot is not connected. Please initialize first.');
            }
            const message = await this.bot.sendVideo(this.config.channelId, videoBuffer, {
                caption: caption,
                parse_mode: 'HTML'
            });
            console.log('✓ Video sent to Telegram channel');
            return { success: true, messageId: message.message_id };
        }
        catch (error) {
            console.error('Error sending Telegram video:', error);
            throw error;
        }
    }
    async sendDocument(documentBuffer, caption, fileName) {
        try {
            if (!this.isConnected) {
                throw new Error('Telegram bot is not connected. Please initialize first.');
            }
            const message = await this.bot.sendDocument(this.config.channelId, documentBuffer, {
                caption: caption,
                parse_mode: 'HTML'
            }, {
                filename: fileName
            });
            console.log('✓ Document sent to Telegram channel');
            return { success: true, messageId: message.message_id };
        }
        catch (error) {
            console.error('Error sending Telegram document:', error);
            throw error;
        }
    }
    async sendMediaMessage(mediaBuffer, mediaType, fileName, caption) {
        try {
            if (!this.isConnected) {
                throw new Error('Telegram bot is not connected. Please initialize first.');
            }
            if (mediaType.startsWith('image/')) {
                return await this.sendPhoto(mediaBuffer, caption, fileName);
            }
            else if (mediaType.startsWith('video/')) {
                return await this.sendVideo(mediaBuffer, caption, fileName);
            }
            else {
                return await this.sendDocument(mediaBuffer, caption, fileName);
            }
        }
        catch (error) {
            console.error('Error sending media message:', error);
            throw error;
        }
    }
    getConnectionStatus() {
        return this.isConnected;
    }
    getChannelInfo() {
        return {
            channelId: this.config.channelId,
            botToken: this.config.botToken.substring(0, 10) + '...',
            userId: this.config.userId
        };
    }
}
exports.default = new TelegramService();
