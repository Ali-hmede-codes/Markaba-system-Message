import express from 'express';
import multer from 'multer';
import telegramService from '../services/telegramService';
import { isFileTypeSupported } from '../config/mediaTypes';

const router = express.Router();

// Configure multer for file uploads (50MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// Initialize Telegram bot
router.post('/initialize', async (req, res) => {
  try {
    await telegramService.initialize();
    res.json({ 
      success: true, 
      message: 'Telegram bot initialized successfully',
      channelInfo: telegramService.getChannelInfo()
    });
  } catch (error) {
    console.error('Telegram initialization error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get Telegram connection status
router.get('/status', (req, res) => {
  try {
    const isConnected = telegramService.getConnectionStatus();
    res.json({ 
      success: true, 
      connected: isConnected,
      channelInfo: isConnected ? telegramService.getChannelInfo() : null
    });
  } catch (error) {
    console.error('Error getting Telegram status:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Send text message to Telegram
router.post('/send-message', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }

    const result = await telegramService.sendMessage(message);
    res.json({ 
      success: true, 
      message: 'Message sent to Telegram successfully',
      telegramResult: result
    });
  } catch (error) {
    console.error('Error sending message to Telegram:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Send media message to Telegram
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

    // Validate file type using centralized configuration
    if (!isFileTypeSupported(file.originalname, file.mimetype)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Unsupported file type. Only supported images, videos, audio, documents, and archives are allowed.' 
      });
    }

    const result = await telegramService.sendMediaMessage(
      file.buffer,
      file.mimetype,
      file.originalname,
      message || ''
    );
    
    res.json({ 
      success: true, 
      message: 'Media sent to Telegram successfully',
      telegramResult: result
    });
  } catch (error) {
    console.error('Error sending media to Telegram:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;