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
const router = express.Router();
// Configure multer for file uploads
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow images, videos, audio, and documents
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
// Initialize WhatsApp client
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
// Get status
router.get('/status', (req, res) => {
    const state = whatsappService_1.default.getState();
    res.json({
        connected: state === 'READY',
        qrCode: whatsappService_1.default.getQR(),
        state: state
    });
});
// Get QR code
router.get('/qr', (req, res) => {
    const qr = whatsappService_1.default.getQR();
    if (qr) {
        res.json({ success: true, qrCode: qr });
    }
    else {
        res.json({ success: false, message: 'QR code not available' });
    }
});
// Get groups
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
// Send message to groups (with optional media)
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
        // Parse groupIds if it's a JSON string (from FormData)
        if (typeof groupIds === 'string') {
            try {
                groupIds = JSON.parse(groupIds);
            }
            catch (parseError) {
                return res.status(400).json({ success: false, message: 'Invalid groupIds format' });
            }
        }
        // Parse batchSize if it's a string (from FormData)
        if (typeof batchSize === 'string') {
            batchSize = parseInt(batchSize, 10) || 3;
        }
        if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No groups selected' });
        }
        if (!message || message.trim() === '') {
            return res.status(400).json({ success: false, message: 'Message cannot be empty' });
        }
        let results;
        if (mediaFile) {
            // Send media message
            console.log(`Sending media message: ${mediaFile.originalname} (${mediaFile.mimetype})`);
            results = await whatsappService_1.default.sendMessages(groupIds, message, batchSize, mediaFile.buffer, mediaFile.mimetype, mediaFile.originalname);
        }
        else {
            // Send text message
            results = await whatsappService_1.default.sendMessages(groupIds, message, batchSize);
        }
        res.json({ success: true, results });
    }
    catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// Send text-only message (legacy endpoint)
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
// Logout
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
// Clear session
router.post('/auth/clear', async (req, res) => {
    try {
        await whatsappService_1.default.clearSession();
        res.json({ success: true, message: 'Session cleared successfully' });
    }
    catch (error) {
        console.error('Error clearing session:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});
// Save favorite groups
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
// Load favorite groups
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
