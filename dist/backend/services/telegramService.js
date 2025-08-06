"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
class TelegramService extends events_1.EventEmitter {
    config;
    baseUrl;
    isConnected = false;
    constructor() {
        super();
        this.config = {
            botToken: '8278027059:AAGEH3PPqRNk-LPUPtV5wAUwdu4FXCXhR20',
            channelId: '@markaba_news_bot',
            userId: 989228365
        };
        this.baseUrl = `https://api.telegram.org/bot${this.config.botToken}`;
    }
    async initialize() {
        try {
            const response = await this.makeRequest('/getMe');
            if (response.ok) {
                this.isConnected = true;
                console.log('✓ Telegram bot connected:', response.result.username);
                this.emit('connected', true);
            }
            else {
                throw new Error('Failed to connect to Telegram bot');
            }
        }
        catch (error) {
            console.error('Telegram connection error:', error);
            this.isConnected = false;
            this.emit('connected', false);
            throw error;
        }
    }
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const response = await fetch(url, options);
        const data = await response.json();
        return data;
    }
    async sendMessage(text) {
        try {
            const response = await this.makeRequest('/sendMessage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: this.config.channelId,
                    text: text,
                    parse_mode: 'HTML'
                })
            });
            if (response.ok) {
                console.log('✓ Message sent to Telegram channel');
                return { success: true, messageId: response.result.message_id };
            }
            else {
                throw new Error(response.description || 'Failed to send message');
            }
        }
        catch (error) {
            console.error('Error sending Telegram message:', error);
            throw error;
        }
    }
    async sendPhoto(photoBuffer, caption, fileName) {
        try {
            const formData = new FormData();
            const blob = new Blob([photoBuffer]);
            formData.append('photo', blob, fileName);
            formData.append('chat_id', this.config.channelId);
            if (caption)
                formData.append('caption', caption);
            formData.append('parse_mode', 'HTML');
            const response = await this.makeRequest('/sendPhoto', {
                method: 'POST',
                body: formData
            });
            if (response.ok) {
                console.log('✓ Photo sent to Telegram channel');
                return { success: true, messageId: response.result.message_id };
            }
            else {
                throw new Error(response.description || 'Failed to send photo');
            }
        }
        catch (error) {
            console.error('Error sending Telegram photo:', error);
            throw error;
        }
    }
    async sendVideo(videoBuffer, caption, fileName) {
        try {
            const formData = new FormData();
            const blob = new Blob([videoBuffer]);
            formData.append('video', blob, fileName);
            formData.append('chat_id', this.config.channelId);
            if (caption)
                formData.append('caption', caption);
            formData.append('parse_mode', 'HTML');
            const response = await this.makeRequest('/sendVideo', {
                method: 'POST',
                body: formData
            });
            if (response.ok) {
                console.log('✓ Video sent to Telegram channel');
                return { success: true, messageId: response.result.message_id };
            }
            else {
                throw new Error(response.description || 'Failed to send video');
            }
        }
        catch (error) {
            console.error('Error sending Telegram video:', error);
            throw error;
        }
    }
    async sendDocument(documentBuffer, caption, fileName) {
        try {
            const formData = new FormData();
            const blob = new Blob([documentBuffer]);
            formData.append('document', blob, fileName);
            formData.append('chat_id', this.config.channelId);
            if (caption)
                formData.append('caption', caption);
            formData.append('parse_mode', 'HTML');
            const response = await this.makeRequest('/sendDocument', {
                method: 'POST',
                body: formData
            });
            if (response.ok) {
                console.log('✓ Document sent to Telegram channel');
                return { success: true, messageId: response.result.message_id };
            }
            else {
                throw new Error(response.description || 'Failed to send document');
            }
        }
        catch (error) {
            console.error('Error sending Telegram document:', error);
            throw error;
        }
    }
    async sendMediaMessage(mediaBuffer, mediaType, fileName, caption) {
        try {
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
            console.error('Error sending media to Telegram:', error);
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
