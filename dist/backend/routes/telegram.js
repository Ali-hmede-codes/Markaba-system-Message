"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const telegramService_1 = __importDefault(require("../services/telegramService"));
const mediaTypes_1 = require("../config/mediaTypes");
const router = express_1.default.Router();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024
    }
});
router.post('/initialize', async (req, res) => {
    try {
        await telegramService_1.default.initialize();
        res.json({
            success: true,
            message: 'Telegram bot initialized successfully',
            channelInfo: telegramService_1.default.getChannelInfo()
        });
    }
    catch (error) {
        console.error('Telegram initialization error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/status', (req, res) => {
    try {
        const isConnected = telegramService_1.default.getConnectionStatus();
        res.json({
            success: true,
            connected: isConnected,
            channelInfo: isConnected ? telegramService_1.default.getChannelInfo() : null
        });
    }
    catch (error) {
        console.error('Error getting Telegram status:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/send-message', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }
        const result = await telegramService_1.default.sendMessage(message);
        res.json({
            success: true,
            message: 'Message sent to Telegram successfully',
            telegramResult: result
        });
    }
    catch (error) {
        console.error('Error sending message to Telegram:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/send-media', upload.single('media'), async (req, res) => {
    try {
        const { message } = req.body;
        const file = req.file;
        if (!file) {
            return res.status(400).json({
                success: false,
                error: 'Media file is required'
            });
        }
        if (!(0, mediaTypes_1.isFileTypeSupported)(file.originalname, file.mimetype)) {
            return res.status(400).json({
                success: false,
                error: 'Unsupported file type. Only supported images, videos, audio, documents, and archives are allowed.'
            });
        }
        const result = await telegramService_1.default.sendMediaMessage(file.buffer, file.mimetype, file.originalname, message || '');
        res.json({
            success: true,
            message: 'Media sent to Telegram successfully',
            telegramResult: result
        });
    }
    catch (error) {
        console.error('Error sending media to Telegram:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
