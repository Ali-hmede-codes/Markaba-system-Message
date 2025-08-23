import * as express from 'express';
import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as fs from 'fs-extra';
import * as path from 'path';
import whatsappService from '../services/whatsappService';
import telegramService from '../services/telegramService';
import { createFileValidationRegex, isFileTypeSupported } from '../config/mediaTypes';

// Backend duplicate prevention
interface MessageCache {
  fingerprint: string;
  timestamp: number;
  groups: string[];
  message: string;
}

const messageCache = new Map<string, MessageCache>();
const currentBatches = new Set<string>(); // Track currently processing batches
let lastCompletedBatch: string | null = null; // Track last successfully completed batch

// Create message fingerprint for backend duplicate detection
function createMessageFingerprint(message: string, groupIds: string[], hasMedia: boolean): string {
  const groupsString = groupIds.sort().join(',');
  const mediaFlag = hasMedia ? 'media' : 'text';
  const content = `${message}|${groupsString}|${mediaFlag}`;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

// Check for duplicate messages
function isDuplicateMessage(fingerprint: string): boolean {
  // Check if this batch is currently being processed
  if (currentBatches.has(fingerprint)) {
    return true;
  }
  
  // Check if this was the last completed batch
  if (lastCompletedBatch === fingerprint) {
    return true;
  }
  
  return false;
}

// Store message in cache and mark as processing
function startBatchProcessing(fingerprint: string, message: string, groups: string[]): void {
  currentBatches.add(fingerprint);
  messageCache.set(fingerprint, {
    fingerprint,
    timestamp: Date.now(),
    groups,
    message
  });
}

// Mark batch as completed
function completeBatchProcessing(fingerprint: string): void {
  currentBatches.delete(fingerprint);
  lastCompletedBatch = fingerprint;
}

// Clean up failed batch
function cleanupFailedBatch(fingerprint: string): void {
  currentBatches.delete(fingerprint);
}

const router: Router = express.Router();

// Function to read settings
function readSettings() {
  try {
    const settingsPath = path.join(process.cwd(), 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(settingsData);
    }
  } catch (error) {
    console.error('Error reading settings:', error);
  }
  // Return default settings if file doesn't exist or error occurs
  return {
    sendToTelegram: false,
    sendToWhatsApp: true,
    telegramSettings: false,
    batchSize: 10
  };
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Use centralized file type validation
    if (isFileTypeSupported(file.originalname, file.mimetype)) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only supported images, videos, audio, documents, and archives are allowed.'));
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
  try {
    const state = whatsappService.getState();
    const isConnected = state === 'READY';
    const isAuthenticated = state === 'READY' || state === 'AUTHENTICATED';
    
    res.json({
      success: true,
      connected: isConnected,
      isConnected: isConnected,
      isAuthenticated: isAuthenticated,
      qrCode: whatsappService.getQR(),
      state: state
    });
  } catch (error) {
    console.error('Error getting WhatsApp status:', error);
    res.status(500).json({
      success: false,
      connected: false,
      isConnected: false,
      isAuthenticated: false,
      error: (error as Error).message
    });
  }
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
  let messageFingerprint: string | null = null;
  
  try {
    let { groupIds, message } = req.body;
    
    // Read batch size from settings instead of request body
    const settings = readSettings();
    const batchSize = settings.batchSize || 10;
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
    
    // Batch size is now controlled from admin settings only
    
    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No groups selected' });
    }
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }
    
    // Check for duplicate messages on backend
    const hasMedia = !!mediaFile;
    messageFingerprint = createMessageFingerprint(message, groupIds, hasMedia);
    
    if (isDuplicateMessage(messageFingerprint)) {
      console.log('Duplicate message detected on backend:', messageFingerprint);
      return res.status(429).json({ 
        success: false, 
        message: 'Duplicate message detected. Please wait before sending the same message again.' 
      });
    }
    
    // Start batch processing to prevent duplicates
    startBatchProcessing(messageFingerprint, message, groupIds);
    
    // Settings already read above for batch size
    
    let whatsappResults;
    let telegramResult = null;
    
    // Send to WhatsApp only if enabled in settings
    if (settings.sendToWhatsApp) {
      if (mediaFile) {
        // Send media message
        console.log(`Sending media message to WhatsApp: ${mediaFile.originalname} (${mediaFile.mimetype})`);
        whatsappResults = await whatsappService.sendMessages(
          groupIds, 
          message, 
          batchSize,
          mediaFile.buffer,
          mediaFile.mimetype,
          mediaFile.originalname
        );
      } else {
        // Send text message
        whatsappResults = await whatsappService.sendMessages(groupIds, message, batchSize);
      }
    } else {
      console.log('WhatsApp sending disabled in settings');
      whatsappResults = { success: false, message: 'WhatsApp sending disabled in settings' };
    }
    
    // Send to Telegram only if enabled in settings and connected
    if (settings.sendToTelegram && telegramService.getConnectionStatus()) {
      try {
        console.log('Sending message to Telegram...');
        if (mediaFile) {
          telegramResult = await telegramService.sendMediaMessage(
            mediaFile.buffer,
            mediaFile.mimetype,
            mediaFile.originalname,
            message
          );
        } else {
          telegramResult = await telegramService.sendMessage(message);
        }
      } catch (telegramError) {
        console.error('Telegram failed:', telegramError);
        telegramResult = { 
          success: false, 
          error: telegramError instanceof Error ? telegramError.message : 'Unknown error' 
        };
      }
    } else if (!settings.sendToTelegram) {
      console.log('Telegram sending disabled in settings');
      telegramResult = { success: false, message: 'Telegram sending disabled in settings' };
    } else {
      telegramResult = { success: false, message: 'Telegram not connected' };
    }
    
    // Mark batch as completed since messages were processed
    completeBatchProcessing(messageFingerprint);
    
    // Prepare response message
    let responseMessage = 'Message sent to WhatsApp groups';
    if (telegramResult?.success) {
      responseMessage += ' and Telegram';
    }
    
    res.json({ 
      success: true, 
      whatsappResults,
      telegramResult,
      message: responseMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    
    // Clean up failed batch if fingerprint was created
    if (messageFingerprint) {
      cleanupFailedBatch(messageFingerprint);
    }
    
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

// Send text-only message (legacy endpoint)
router.post('/send-text', async (req: Request, res: Response) => {
  let messageFingerprint: string | null = null;
  
  try {
    const { groupIds, message } = req.body;
    
    // Read batch size from settings instead of request body
    const settings = readSettings();
    const batchSize = settings.batchSize || 10;
    
    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No groups selected' });
    }
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }
    
    // Check for duplicate messages on backend
    messageFingerprint = createMessageFingerprint(message, groupIds, false);
    
    if (isDuplicateMessage(messageFingerprint)) {
      console.log('Duplicate text message detected on backend:', messageFingerprint);
      return res.status(429).json({ 
        success: false, 
        message: 'Duplicate message detected. Please wait before sending the same message again.' 
      });
    }
    
    // Start batch processing to prevent duplicates
    startBatchProcessing(messageFingerprint, message, groupIds);
    
    const results = await whatsappService.sendMessages(groupIds, message, batchSize);
    
    // Mark batch as completed
    completeBatchProcessing(messageFingerprint);
    
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error sending text message:', error);
    
    // Clean up failed batch if fingerprint was created
    if (messageFingerprint) {
      cleanupFailedBatch(messageFingerprint);
    }
    
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
router.post('/clear-session', async (req: Request, res: Response) => {
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

// Link Preview Management Routes
router.post('/link-preview/toggle', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled parameter must be a boolean'
      });
    }
    
    whatsappService.setLinkPreviewEnabled(enabled);
    
    res.json({
      success: true,
      linkPreviewEnabled: enabled,
      message: `Link preview ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('Error toggling link preview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle link preview'
    });
  }
});

router.get('/link-preview/status', (req: Request, res: Response) => {
  try {
    const enabled = whatsappService.getLinkPreviewEnabled();
    
    res.json({
      success: true,
      linkPreviewEnabled: enabled
    });
  } catch (error) {
    console.error('Error getting link preview status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get link preview status'
    });
  }
});

export default router;