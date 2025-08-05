import * as express from 'express';
import { Router, Request, Response } from 'express';
import multer from 'multer';
import whatsappService from '../services/whatsappService';

const router: Router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
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
    } else {
      cb(new Error('Invalid file type. Only images, videos, audio, and documents are allowed.'));
    }
  }
});

// Initialize WhatsApp client
router.post('/init', async (req: Request, res: Response) => {
  try {
    const { forceNew = false } = req.body;
    
    if (whatsappService.getConnectionStatus() && !forceNew) {
      return res.json({ 
        success: true, 
        message: 'WhatsApp client already connected'
      });
    }
    
    if (forceNew) {
      await whatsappService.clearSession();
    }
    
    await whatsappService.initialize();
    res.json({ 
      success: true, 
      message: 'WhatsApp client initialization started',
      state: whatsappService.getState()
    });
  } catch (error) {
    console.error('Error initializing WhatsApp client:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Get status
router.get('/status', (req: Request, res: Response) => {
  const state = whatsappService.getState();
  res.json({
    connected: state === 'READY',
    qrCode: whatsappService.getQR(),
    state: state
  });
});

// Get QR code
router.get('/qr', (req: Request, res: Response) => {
  const qr = whatsappService.getQR();
  if (qr) {
    res.json({ success: true, qrCode: qr });
  } else {
    res.json({ success: false, message: 'QR code not available' });
  }
});

// Get groups
router.get('/groups', async (req: Request, res: Response) => {
  try {
    const groups = await whatsappService.getGroups();
    res.json({ success: true, groups });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Send message to groups (with optional media)
router.post('/send', upload.single('media'), async (req: Request, res: Response) => {
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
      } catch (parseError) {
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
      results = await whatsappService.sendMessages(
        groupIds, 
        message, 
        batchSize,
        mediaFile.buffer,
        mediaFile.mimetype,
        mediaFile.originalname
      );
    } else {
      // Send text message
      results = await whatsappService.sendMessages(groupIds, message, batchSize);
    }
    
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Send text-only message (legacy endpoint)
router.post('/send-text', async (req: Request, res: Response) => {
  try {
    const { groupIds, message, batchSize = 3 } = req.body;
    
    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No groups selected' });
    }
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }
    
    const results = await whatsappService.sendMessages(groupIds, message, batchSize);
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
})

// Logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    await whatsappService.logout();
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Clear session
router.post('/auth/clear', async (req: Request, res: Response) => {
  try {
    await whatsappService.clearSession();
    res.json({ success: true, message: 'Session cleared successfully' });
  } catch (error) {
    console.error('Error clearing session:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Save favorite groups
router.post('/favorites', async (req: Request, res: Response) => {
  try {
    const { groups } = req.body;
    
    if (!groups || !Array.isArray(groups)) {
      return res.status(400).json({ success: false, message: 'Invalid groups data' });
    }
    
    const result = await whatsappService.saveFavoriteGroups(groups);
    
    if (result.success) {
      res.json({ success: true, message: 'Favorite groups saved successfully' });
    } else {
      res.status(500).json({ success: false, message: result.error || 'Failed to save favorite groups' });
    }
  } catch (error) {
    console.error('Error saving favorite groups:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Load favorite groups
router.get('/favorites', async (req: Request, res: Response) => {
  try {
    const result = await whatsappService.getFavoriteGroups();
    
    if (result.success) {
      res.json({ success: true, groups: result.groups || [] });
    } else {
      res.status(500).json({ success: false, message: result.error || 'Failed to load favorite groups' });
    }
  } catch (error) {
    console.error('Error loading favorite groups:', error);
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

export default router;