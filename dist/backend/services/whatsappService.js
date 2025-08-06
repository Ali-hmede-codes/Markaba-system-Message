"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const qrcode = __importStar(require("qrcode"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const events_1 = require("events");
class WhatsAppService extends events_1.EventEmitter {
    socket = null;
    qrCode = null;
    isConnected = false;
    authState = 'DISCONNECTED';
    favoritesPath = path.join(__dirname, '../../../favorites.json');
    cachePath = path.join(__dirname, '../../../cachedGroups.json');
    channelsCachePath = path.join(__dirname, '../../../cachedChannels.json');
    cacheMaxAge = 5 * 60 * 1000;
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    isInitializing = false;
    constructor() {
        super();
    }
    async initialize() {
        try {
            if (this.isInitializing) {
                console.log('Already initializing, skipping...');
                return;
            }
            this.isInitializing = true;
            if (this.socket) {
                try {
                    this.socket.end(undefined);
                }
                catch (err) {
                    console.warn('Error ending previous socket:', err);
                }
                this.socket = null;
            }
            this.isConnected = false;
            this.qrCode = null;
            this.updateAuthState('CONNECTING');
            const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)(path.join(__dirname, '../../../.wwebjs_auth'));
            const logger = {
                level: 'silent',
                trace: () => { },
                debug: () => { },
                info: () => { },
                warn: () => { },
                error: () => { },
                fatal: () => { },
                child: () => logger
            };
            this.socket = (0, baileys_1.default)({
                auth: state,
                printQRInTerminal: false,
                qrTimeout: 60000,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 0,
                keepAliveIntervalMs: 10000,
                logger: logger,
                markOnlineOnConnect: true,
                browser: ['WhatsApp Bulk Sender', 'Chrome', '1.0.0']
            });
            this.socket.ev.on('creds.update', saveCreds);
            this.socket.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr, isNewLogin } = update;
                console.log('Connection update:', { connection, isNewLogin });
                if (qr) {
                    this.updateAuthState('QR_REQUIRED');
                    try {
                        this.qrCode = await qrcode.toDataURL(qr);
                        this.emit('qr', this.qrCode);
                        console.log('QR code generated successfully');
                        setTimeout(() => {
                            if (this.authState === 'QR_REQUIRED') {
                                this.qrCode = null;
                                console.log('QR code expired');
                            }
                        }, 600000);
                    }
                    catch (err) {
                        console.error('Error generating QR:', err);
                    }
                }
                if (connection === 'close') {
                    this.isInitializing = false;
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== baileys_1.DisconnectReason.loggedOut &&
                        statusCode !== baileys_1.DisconnectReason.forbidden &&
                        this.reconnectAttempts < this.maxReconnectAttempts;
                    console.log('Connection closed:', {
                        error: lastDisconnect?.error?.message,
                        statusCode,
                        shouldReconnect,
                        attempts: this.reconnectAttempts
                    });
                    this.updateAuthState('DISCONNECTED');
                    this.isConnected = false;
                    this.emit('connection', false);
                    if (shouldReconnect) {
                        this.reconnectAttempts++;
                        const delay = Math.min(30000 * this.reconnectAttempts, 300000);
                        console.log(`Reconnecting in ${delay / 1000} seconds (attempt ${this.reconnectAttempts})`);
                        setTimeout(() => this.initialize(), delay);
                    }
                    else {
                        if (statusCode === baileys_1.DisconnectReason.loggedOut) {
                            console.log('Logged out, clearing auth data');
                            await this.clearAuthData();
                        }
                        this.reconnectAttempts = 0;
                    }
                }
                if (connection === 'connecting') {
                    this.updateAuthState('CONNECTING');
                    console.log('Connecting to WhatsApp...');
                }
                if (connection === 'open') {
                    console.log('Connection opened successfully');
                    this.updateAuthState('READY');
                    this.isConnected = true;
                    this.qrCode = null;
                    this.reconnectAttempts = 0;
                    this.isInitializing = false;
                    this.emit('connection', true);
                    setTimeout(() => {
                        console.log('WhatsApp ready for operations');
                    }, 3000);
                }
            });
        }
        catch (error) {
            console.error('Error initializing Baileys socket:', error);
            this.updateAuthState('DISCONNECTED');
            this.isInitializing = false;
            this.reconnectAttempts++;
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                const delay = Math.min(10000 * this.reconnectAttempts, 60000);
                console.log(`Retrying initialization in ${delay / 1000} seconds...`);
                setTimeout(() => this.initialize(), delay);
            }
            else {
                console.error('Max initialization attempts reached');
                throw error;
            }
        }
    }
    updateAuthState(newState) {
        const oldState = this.authState;
        this.authState = newState;
        console.log(`Auth state changed: ${oldState} -> ${newState}`);
        this.emit('authStateChanged', { oldState, newState });
    }
    onConnection(callback) {
        this.on('connection', callback);
        if (this.isConnected)
            callback(true);
    }
    onQR(callback) {
        this.on('qr', callback);
        if (this.qrCode)
            callback(this.qrCode);
    }
    async getGroups(forceRefresh = false) {
        if (!this.socket)
            throw new Error('Socket not initialized');
        if (!forceRefresh) {
            try {
                if (await fs.pathExists(this.cachePath)) {
                    const cacheData = await fs.readJson(this.cachePath);
                    if (Date.now() - cacheData.timestamp < this.cacheMaxAge && Array.isArray(cacheData.groups)) {
                        console.log(`Returning ${cacheData.groups.length} cached groups (age: ${Math.round((Date.now() - cacheData.timestamp) / 1000)}s)`);
                        this.refreshGroupsInBackground();
                        return cacheData.groups;
                    }
                }
            }
            catch (err) {
                console.warn('Cache load failed:', err);
                try {
                    await fs.remove(this.cachePath);
                }
                catch (unlinkErr) {
                    console.warn('Could not delete corrupted cache:', unlinkErr);
                }
            }
        }
        if (!this.isConnected || this.authState !== 'READY') {
            throw new Error(`WhatsApp not ready (state: ${this.authState})`);
        }
        const maxRetries = 5;
        let retryCount = 0;
        while (retryCount < maxRetries) {
            try {
                const waitTime = retryCount === 0 ? 15 : (10 + retryCount * 10);
                await (0, baileys_1.delay)(waitTime * 1000);
                const fetchPromise = this.socket.groupFetchAllParticipating();
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Group fetch timeout')), 30000);
                });
                const groups = await Promise.race([fetchPromise, timeoutPromise]);
                if (!groups || typeof groups !== 'object') {
                    throw new Error('Invalid response from WhatsApp');
                }
                const formattedGroups = Object.values(groups)
                    .filter((g) => g && g.id && g.id.endsWith('@g.us'))
                    .map((g) => ({
                    id: g.id,
                    name: g.subject || 'Unnamed Group',
                    participants: Array.isArray(g.participants) ? g.participants.length : 0
                }))
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                try {
                    await fs.writeJson(this.cachePath, { timestamp: Date.now(), groups: formattedGroups });
                    console.log('Groups cached successfully');
                }
                catch (cacheErr) {
                    console.warn('Failed to cache groups:', cacheErr);
                }
                console.log(`Successfully fetched ${formattedGroups.length} groups`);
                return formattedGroups;
            }
            catch (err) {
                console.error(`Error on attempt ${retryCount + 1}:`, err);
                retryCount++;
                if (retryCount >= maxRetries) {
                    try {
                        if (await fs.pathExists(this.cachePath)) {
                            const cacheData = await fs.readJson(this.cachePath);
                            if (Array.isArray(cacheData.groups)) {
                                console.log('Returning stale cached groups as fallback');
                                return cacheData.groups;
                            }
                        }
                    }
                    catch (fallbackErr) {
                        console.warn('Could not read fallback cache:', fallbackErr);
                    }
                    throw new Error(`Failed after ${maxRetries} attempts: ${err.message}`);
                }
            }
        }
        throw new Error('Unexpected error');
    }
    async refreshGroupsInBackground() {
        try {
            console.log('Starting background refresh');
            await this.getGroups(true);
            console.log('Background refresh completed');
        }
        catch (err) {
            console.error('Background refresh failed:', err);
        }
    }
    async getChannels(forceRefresh = false) {
        if (!this.socket)
            throw new Error('Socket not initialized');
        if (!forceRefresh) {
            try {
                if (await fs.pathExists(this.channelsCachePath)) {
                    const cacheData = await fs.readJson(this.channelsCachePath);
                    if (Date.now() - cacheData.timestamp < this.cacheMaxAge && Array.isArray(cacheData.channels)) {
                        console.log(`Returning ${cacheData.channels.length} cached channels (age: ${Math.round((Date.now() - cacheData.timestamp) / 1000)}s)`);
                        return cacheData.channels;
                    }
                }
            }
            catch (err) {
                console.warn('Channels cache load failed:', err);
            }
        }
        if (!this.isConnected || this.authState !== 'READY') {
            throw new Error(`WhatsApp not ready (state: ${this.authState})`);
        }
        try {
            console.log('Fetching WhatsApp channels...');
            const channels = [];
            try {
                const chats = Object.values(this.socket.chats || {});
                console.log(`DEBUG: Total chats found: ${chats.length}`);
                console.log('DEBUG: Chat IDs and types:');
                chats.forEach((chat, index) => {
                    if (chat && chat.id) {
                        console.log(`  ${index + 1}. ID: ${chat.id}, Type: ${chat.id.split('@')[1]}, Name: ${chat.name || chat.subject || 'N/A'}`);
                    }
                });
                for (const chat of chats) {
                    if (chat && chat.id && chat.id.endsWith('@newsletter')) {
                        console.log(`DEBUG: Found newsletter chat: ${chat.id}`);
                        channels.push({
                            id: chat.id,
                            name: chat.name || chat.subject || chat.id.split('@')[0],
                            description: chat.description || undefined,
                            verified: chat.verified || false
                        });
                    }
                }
                console.log(`Found ${channels.length} channels`);
                const cacheData = {
                    channels,
                    timestamp: Date.now()
                };
                try {
                    await fs.writeJson(this.channelsCachePath, cacheData);
                    console.log('Channels cached successfully');
                }
                catch (cacheErr) {
                    console.warn('Failed to cache channels:', cacheErr);
                }
                return channels;
            }
            catch (channelErr) {
                console.warn('Failed to fetch channels - this feature is experimental:', channelErr);
                return [];
            }
        }
        catch (error) {
            console.error('Error fetching channels:', error);
            throw new Error(`Failed to fetch channels: ${error.message}`);
        }
    }
    async sendMessages(groupIds, message, batchSize = 3, mediaBuffer, mediaType, fileName) {
        if (!this.socket) {
            throw new Error('WhatsApp socket not initialized');
        }
        if (!this.isConnected || this.authState !== 'READY') {
            throw new Error(`WhatsApp not ready (state: ${this.authState})`);
        }
        if (!Array.isArray(groupIds) || groupIds.length === 0) {
            throw new Error('No group IDs provided');
        }
        if (!message || message.trim().length === 0) {
            throw new Error('Message cannot be empty');
        }
        console.log(`Sending ${mediaBuffer ? 'media ' : ''}message to ${groupIds.length} groups in batches of ${batchSize}`);
        const results = [];
        for (let i = 0; i < groupIds.length; i += batchSize) {
            const batch = groupIds.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(groupIds.length / batchSize)}`);
            const batchPromises = batch.map(async (groupId) => {
                try {
                    if (!groupId.endsWith('@g.us')) {
                        throw new Error('Invalid group ID format');
                    }
                    let messageContent;
                    if (mediaBuffer && mediaType) {
                        if (mediaType.startsWith('image/')) {
                            messageContent = {
                                image: mediaBuffer,
                                caption: message.trim(),
                                fileName: fileName || 'image.jpg'
                            };
                        }
                        else if (mediaType.startsWith('video/')) {
                            let defaultFileName = 'video.mp4';
                            if (mediaType.includes('quicktime') || mediaType.includes('mov')) {
                                defaultFileName = 'video.mov';
                            }
                            else if (mediaType.includes('avi')) {
                                defaultFileName = 'video.avi';
                            }
                            messageContent = {
                                video: mediaBuffer,
                                caption: message.trim(),
                                fileName: fileName || defaultFileName
                            };
                        }
                        else if (mediaType.startsWith('audio/')) {
                            messageContent = {
                                audio: mediaBuffer,
                                fileName: fileName || 'audio.mp3'
                            };
                            if (message.trim()) {
                                await this.socket.sendMessage(groupId, { text: message.trim() });
                            }
                        }
                        else {
                            messageContent = {
                                document: mediaBuffer,
                                fileName: fileName || 'document',
                                caption: message.trim()
                            };
                        }
                    }
                    else {
                        messageContent = { text: message.trim() };
                    }
                    await this.socket.sendMessage(groupId, messageContent);
                    console.log(`✓ ${mediaBuffer ? 'Media m' : 'M'}essage sent to ${groupId}`);
                    return { groupId, success: true };
                }
                catch (error) {
                    const errorMessage = error.message;
                    console.error(`✗ Failed to send to ${groupId}:`, errorMessage);
                    return { groupId, success: false, error: errorMessage };
                }
            });
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            if (i + batchSize < groupIds.length) {
                console.log('Waiting 2 seconds before next batch...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        const successCount = results.filter(r => r.success).length;
        console.log(`${mediaBuffer ? 'Media m' : 'M'}essage sending completed: ${successCount}/${results.length} successful`);
        return results;
    }
    async sendChannelMessages(channelIds, message, batchSize = 2, mediaBuffer, mediaType, fileName) {
        if (!this.socket) {
            throw new Error('WhatsApp socket not initialized');
        }
        if (!this.isConnected || this.authState !== 'READY') {
            throw new Error(`WhatsApp not ready (state: ${this.authState})`);
        }
        if (!Array.isArray(channelIds) || channelIds.length === 0) {
            throw new Error('No channel IDs provided');
        }
        if (!message || message.trim().length === 0) {
            throw new Error('Message cannot be empty');
        }
        console.log(`⚠️  EXPERIMENTAL: Sending ${mediaBuffer ? 'media ' : ''}message to ${channelIds.length} channels in batches of ${batchSize}`);
        console.log('⚠️  Note: WhatsApp Channels support in Baileys is experimental and may not work as expected');
        const results = [];
        for (let i = 0; i < channelIds.length; i += batchSize) {
            const batch = channelIds.slice(i, i + batchSize);
            console.log(`Processing channel batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(channelIds.length / batchSize)}`);
            const batchPromises = batch.map(async (channelId) => {
                try {
                    if (!channelId.endsWith('@newsletter')) {
                        throw new Error('Invalid channel ID format - must end with @newsletter');
                    }
                    let messageContent;
                    if (mediaBuffer && mediaType) {
                        if (mediaType.startsWith('image/')) {
                            messageContent = {
                                image: mediaBuffer,
                                caption: message,
                                fileName: fileName || 'image'
                            };
                        }
                        else if (mediaType.startsWith('video/')) {
                            messageContent = {
                                video: mediaBuffer,
                                caption: message,
                                fileName: fileName || 'video'
                            };
                        }
                        else if (mediaType.startsWith('audio/')) {
                            messageContent = {
                                audio: mediaBuffer,
                                fileName: fileName || 'audio'
                            };
                        }
                        else {
                            messageContent = {
                                document: mediaBuffer,
                                fileName: fileName || 'document',
                                caption: message
                            };
                        }
                    }
                    else {
                        messageContent = {
                            text: message
                        };
                    }
                    await this.socket.sendMessage(channelId, messageContent);
                    console.log(`✓ ${mediaBuffer ? 'Media m' : 'M'}essage sent to channel ${channelId}`);
                    return { channelId, success: true };
                }
                catch (error) {
                    const errorMessage = error.message;
                    console.error(`✗ Failed to send to channel ${channelId}:`, errorMessage);
                    return { channelId, success: false, error: errorMessage };
                }
            });
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            if (i + batchSize < channelIds.length) {
                console.log('Waiting 5 seconds before next channel batch...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        const successCount = results.filter(r => r.success).length;
        console.log(`${mediaBuffer ? 'Media m' : 'M'}essage sending to channels completed: ${successCount}/${results.length} successful`);
        if (successCount === 0) {
            console.warn('⚠️  No messages were sent successfully. Channel messaging is experimental and may not be fully supported.');
        }
        return results;
    }
    async shutdown() {
        console.log('Shutting down WhatsApp service...');
        this.isInitializing = false;
        if (this.socket) {
            try {
                this.socket.end(undefined);
            }
            catch (err) {
                console.warn('Error during socket shutdown:', err.message);
            }
            this.socket = null;
        }
        this.isConnected = false;
        this.qrCode = null;
        this.updateAuthState('DISCONNECTED');
        this.reconnectAttempts = 0;
        console.log('WhatsApp service shutdown complete');
    }
    getConnectionStatus() {
        return this.isConnected;
    }
    getState() {
        return this.authState;
    }
    getQR() {
        return this.qrCode;
    }
    async clearSession() {
        return await this.clearAuthData();
    }
    async logout() {
        if (!this.socket)
            return { success: false, message: 'No active session' };
        try {
            await this.socket.logout();
            this.socket.end(new Error('Logged out'));
            this.socket = null;
            this.isConnected = false;
            this.qrCode = null;
            return { success: true, message: 'Logged out' };
        }
        catch (err) {
            console.error('Logout error:', err);
            return { success: false, message: err.message };
        }
    }
    async clearAuthData() {
        try {
            await fs.remove(path.join(__dirname, '../../../.wwebjs_auth'));
            this.updateAuthState('DISCONNECTED');
            return { success: true };
        }
        catch (err) {
            console.error('Clear auth error:', err);
            return { success: false, message: err.message };
        }
    }
    async saveFavoriteGroups(groups) {
        try {
            await fs.writeJSON(this.favoritesPath, { groups });
            return { success: true };
        }
        catch (err) {
            console.error('Save favorites error:', err);
            return { success: false, error: err.message };
        }
    }
    async getFavoriteGroups() {
        try {
            if (await fs.pathExists(this.favoritesPath)) {
                const data = await fs.readJSON(this.favoritesPath);
                return { success: true, groups: data.groups || [] };
            }
            return { success: true, groups: [] };
        }
        catch (err) {
            console.error('Get favorites error:', err);
            return { success: false, error: err.message, groups: [] };
        }
    }
}
exports.default = new WhatsAppService();
