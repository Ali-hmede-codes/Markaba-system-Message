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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express = __importStar(require("express"));
const multer_1 = __importDefault(require("multer"));
const whatsappService_1 = __importDefault(require("../services/whatsappService"));
const telegramService_1 = __importDefault(require("../services/telegramService"));
const router = express.Router();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|mp4|avi|mov|mp3|wav|pdf|doc|docx|txt/;
        const extname = allowedTypes.test(file.originalname.toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only images, videos, audio, and documents are allowed.'));
        }
    }
});
router.post('/init', async (req, res) => {
    try {
        const { forceNew = false } = req.body;
        if (whatsappService_1.default.getConnectionStatus() && !forceNew) {
            return res.json({
                success: true,
                message: 'WhatsApp client already connected'
            });
        }
        if (forceNew) {
            await whatsappService_1.default.clearSession();
        }
        await whatsappService_1.default.initialize();
        res.json({
            success: true,
            message: 'WhatsApp client initialization started',
            state: whatsappService_1.default.getState()
        });
    }
    catch (error) {
        console.error('Error initializing WhatsApp client:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
router.get('/status', (req, res) => {
    const state = whatsappService_1.default.getState();
    res.json({
        connected: state === 'READY',
        qrCode: whatsappService_1.default.getQR(),
        state: state
    });
});
router.get('/qr', (req, res) => {
    const qr = whatsappService_1.default.getQR();
    if (qr) {
        res.json({ success: true, qrCode: qr });
    }
    else {
        res.json({ success: false, message: 'QR code not available' });
    }
});
router.get('/groups', async (req, res) => {
    try {
        const groups = await whatsappService_1.default.getGroups();
        res.json({ success: true, groups });
    }
    catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
router.get('/channels', async (req, res) => {
    try {
        const forceRefresh = req.query.forceRefresh === 'true';
        console.log(`🔍 Channels endpoint called with forceRefresh: ${forceRefresh}`);
        const channels = await whatsappService_1.default.getChannels(forceRefresh);
        console.log(`📡 Sending ${channels.length} channels to frontend`);
        res.json({
            success: true,
            channels,
            warning: 'Channel support is experimental and may not work as expected'
        });
    }
    catch (error) {
        console.error('❌ Error fetching channels:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
router.post('/channels/add', async (req, res) => {
    try {
        const { channelId, name } = req.body;
        if (!channelId) {
            return res.status(400).json({ success: false, message: 'Channel ID is required' });
        }
        const success = await whatsappService_1.default.addChannelById(channelId, name);
        if (success) {
            res.json({
                success: true,
                message: 'Channel added successfully',
                warning: 'Channel support is experimental and may not work as expected'
            });
        }
        else {
            res.status(400).json({ success: false, message: 'Failed to add channel' });
        }
    }
    catch (error) {
        console.error('Error adding channel:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
router.post('/send-channels', upload.single('media'), async (req, res) => {
    try {
        let { channelIds, message, batchSize = 2 } = req.body;
        const mediaFile = req.file;
        console.log('Received channel send request:', {
            channelIds: typeof channelIds === 'string' ? `JSON string: ${channelIds.substring(0, 100)}...` : channelIds,
            message: message ? `${message.substring(0, 50)}...` : 'empty',
            batchSize,
            hasMedia: !!mediaFile,
            mediaType: mediaFile?.mimetype
        });
        if (typeof channelIds === 'string') {
            try {
                channelIds = JSON.parse(channelIds);
            }
            catch (parseError) {
                return res.status(400).json({ success: false, message: 'Invalid channelIds format' });
            }
        }
        if (typeof batchSize === 'string') {
            batchSize = parseInt(batchSize, 10) || 2;
        }
        if (!channelIds || !Array.isArray(channelIds) || channelIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No channels selected' });
        }
        if (!message || message.trim() === '') {
            return res.status(400).json({ success: false, message: 'Message cannot be empty' });
        }
        let results;
        if (mediaFile) {
            console.log(`Sending media message to channels: ${mediaFile.originalname} (${mediaFile.mimetype})`);
            results = await whatsappService_1.default.sendChannelMessages(channelIds, message, batchSize, mediaFile.buffer, mediaFile.mimetype, mediaFile.originalname);
        }
        else {
            results = await whatsappService_1.default.sendChannelMessages(channelIds, message, batchSize);
        }
        res.json({
            success: true,
            results,
            warning: 'Channel messaging is experimental and may not work as expected',
            message: 'Message sent to channels (experimental feature)'
        });
    }
    catch (error) {
        console.error('Error sending message to channels:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
router.post('/send', upload.single('media'), async (req, res) => {
    try {
        let { groupIds, message, batchSize = 3 } = req.body;
        const mediaFile = req.file;
        console.log('Received send request:', {
            groupIds: typeof groupIds === 'string' ? `JSON string: ${groupIds.substring(0, 100)}...` : groupIds,
            message: message ? `${message.substring(0, 50)}...` : 'empty',
            batchSize,
            hasMedia: !!mediaFile,
            mediaType: mediaFile?.mimetype
        });
        if (typeof groupIds === 'string') {
            try {
                groupIds = JSON.parse(groupIds);
            }
            catch (parseError) {
                return res.status(400).json({ success: false, message: 'Invalid groupIds format' });
            }
        }
        if (typeof batchSize === 'string') {
            batchSize = parseInt(batchSize, 10) || 3;
        }
        if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No groups selected' });
        }
        if (!message || message.trim() === '') {
            return res.status(400).json({ success: false, message: 'Message cannot be empty' });
        }
        let whatsappResults;
        let telegramResult = null;
        if (mediaFile) {
            console.log(`Sending media message: ${mediaFile.originalname} (${mediaFile.mimetype})`);
            whatsappResults = await whatsappService_1.default.sendMessages(groupIds, message, batchSize, mediaFile.buffer, mediaFile.mimetype, mediaFile.originalname);
        }
        else {
            whatsappResults = await whatsappService_1.default.sendMessages(groupIds, message, batchSize);
        }
        let channelResults = null;
        try {
            const channels = await whatsappService_1.default.getChannels();
            if (channels.length > 0) {
                const channelIds = channels.map(channel => channel.id);
                console.log(`Auto-sending to ${channelIds.length} channels`);
                if (mediaFile) {
                    channelResults = await whatsappService_1.default.sendChannelMessages(channelIds, message, 2, mediaFile.buffer, mediaFile.mimetype, mediaFile.originalname);
                }
                else {
                    channelResults = await whatsappService_1.default.sendChannelMessages(channelIds, message, 2);
                }
            }
            else {
                channelResults = { success: false, message: 'No channels available' };
            }
        }
        catch (channelError) {
            console.error('Channel sending failed:', channelError);
            channelResults = {
                success: false,
                error: channelError instanceof Error ? channelError.message : 'Unknown error'
            };
        }
        if (telegramService_1.default.getConnectionStatus()) {
            try {
                if (mediaFile) {
                    telegramResult = await telegramService_1.default.sendMediaMessage(mediaFile.buffer, mediaFile.mimetype, mediaFile.originalname, message);
                }
                else {
                    telegramResult = await telegramService_1.default.sendMessage(message);
                }
            }
            catch (telegramError) {
                console.error('Telegram failed:', telegramError);
                telegramResult = {
                    success: false,
                    error: telegramError instanceof Error ? telegramError.message : 'Unknown error'
                };
            }
        }
        else {
            telegramResult = { success: false, message: 'Telegram not connected' };
        }
        let responseMessage = 'Message sent to WhatsApp groups';
        if (Array.isArray(channelResults) && channelResults.some(r => r.success)) {
            responseMessage += ' and channels';
        }
        if (telegramResult?.success) {
            responseMessage += ' and Telegram';
        }
        res.json({
            success: true,
            whatsappResults,
            channelResults,
            telegramResult,
            message: responseMessage
        });
    }
    catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
router.post('/send-text', async (req, res) => {
    try {
        const { groupIds, message, batchSize = 3 } = req.body;
        if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No groups selected' });
        }
        if (!message || message.trim() === '') {
            return res.status(400).json({ success: false, message: 'Message cannot be empty' });
        }
        const results = await whatsappService_1.default.sendMessages(groupIds, message, batchSize);
        res.json({ success: true, results });
    }
    catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
router.post('/logout', async (req, res) => {
    try {
        await whatsappService_1.default.logout();
        res.json({ success: true, message: 'Logged out successfully' });
    }
    catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
router.post('/clear-session', async (req, res) => {
    try {
        await whatsappService_1.default.clearSession();
        res.json({ success: true, message: 'Session cleared successfully' });
    }
    catch (error) {
        console.error('Error clearing session:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
router.post('/favorites', async (req, res) => {
    try {
        const { groups } = req.body;
        if (!groups || !Array.isArray(groups)) {
            return res.status(400).json({ success: false, message: 'Invalid groups data' });
        }
        const result = await whatsappService_1.default.saveFavoriteGroups(groups);
        if (result.success) {
            res.json({ success: true, message: 'Favorite groups saved successfully' });
        }
        else {
            res.status(500).json({ success: false, message: result.error || 'Failed to save favorite groups' });
        }
    }
    catch (error) {
        console.error('Error saving favorite groups:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
router.get('/favorites', async (req, res) => {
    try {
        const result = await whatsappService_1.default.getFavoriteGroups();
        if (result.success) {
            res.json({ success: true, groups: result.groups || [] });
        }
        else {
            res.status(500).json({ success: false, message: result.error || 'Failed to load favorite groups' });
        }
    }
    catch (error) {
        console.error('Error loading favorite groups:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.default = router;
