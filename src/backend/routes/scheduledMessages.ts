import express, { Request, Response } from 'express';
import scheduledMessageService from '../services/scheduledMessageService';
import { CreateScheduledMessageRequest, UpdateScheduledMessageRequest, ScheduledMessageFilter } from '../types/scheduledMessage';
import { checkAuth } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Extend Request interface to include uploadDir
declare global {
  namespace Express {
    interface Request {
      uploadDir?: string;
    }
  }
}

const router = express.Router();

// Configure multer for file uploads with individual directories
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create a unique directory for each message
    const messageId = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const uploadDir = path.join(process.cwd(), 'uploads', 'scheduled-messages', messageId.toString());
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // Store the directory path in request for later use
    (req as any).uploadDir = uploadDir;
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|avi|mov|mp3|wav|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, videos, audio files, and documents are allowed'));
    }
  }
});

/**
 * GET /api/scheduled-messages
 * Get all scheduled messages with optional filtering
 */
router.get('/', checkAuth, async (req: Request, res: Response) => {
  try {
    const filter: ScheduledMessageFilter = {
      status: req.query.status as any,
      recipient_phone: req.query.recipient_phone as string,
      start_date_from: req.query.start_date_from as string,
      start_date_to: req.query.start_date_to as string,
      end_date_from: req.query.end_date_from as string,
      end_date_to: req.query.end_date_to as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };
    
    const messages = await scheduledMessageService.getScheduledMessages(filter);
    res.json({
      success: true,
      data: messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Error fetching scheduled messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheduled messages',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/scheduled-messages/stats
 * Get statistics about scheduled messages
 */
router.get('/stats', checkAuth, async (req: Request, res: Response) => {
  try {
    const stats = await scheduledMessageService.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching scheduled message stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/scheduled-messages/:id
 * Get a specific scheduled message by ID
 */
router.get('/:id', checkAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID'
      });
    }
    
    const message = await scheduledMessageService.getScheduledMessageById(id);
    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error fetching scheduled message:', error);
    if (error instanceof Error && error.message === 'Scheduled message not found') {
      res.status(404).json({
        success: false,
        message: 'Scheduled message not found'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch scheduled message',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

/**
 * POST /api/scheduled-messages
 * Create a new scheduled message
 */
router.post('/', checkAuth, upload.single('media'), async (req: Request, res: Response) => {
  try {
    const { message_text, caption, recipient_phone, start_date, end_date, expire_date, send_times, media_type } = req.body;
    
    // Validation
    if (!recipient_phone || !start_date) {
      return res.status(400).json({
        success: false,
        message: 'Recipient phone and start date are required'
      });
    }
    
    if (!message_text && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Either message text or media file is required'
      });
    }
    
    if (!send_times || !Array.isArray(send_times) || send_times.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one send time is required'
      });
    }
    
    // Validate dates
    const startDate = new Date(start_date);
    const endDate = end_date ? new Date(end_date) : null;
    const expireDate = expire_date ? new Date(expire_date) : null;
    
    if (startDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be in the future'
      });
    }
    
    if (endDate && endDate < startDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }
    
    if (expireDate && expireDate < startDate) {
      return res.status(400).json({
        success: false,
        message: 'Expire date must be after start date'
      });
    }
    
    // Validate send times format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    for (const time of send_times) {
      if (!timeRegex.test(time)) {
        return res.status(400).json({
          success: false,
          message: `Invalid time format: ${time}. Use HH:MM format`
        });
      }
    }
    
    const createData: CreateScheduledMessageRequest = {
      message_text: message_text || null,
      recipient_phone,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate?.toISOString().split('T')[0] || startDate.toISOString().split('T')[0],
      expire_date: expireDate?.toISOString().split('T')[0] || startDate.toISOString().split('T')[0],
      send_times: send_times,
      caption: caption || null
    };
    
    // Handle file upload
    if (req.file) {
      createData.media_path = req.file.path;
      createData.media_type = media_type || getMediaTypeFromFile(req.file);
    }
    
    const userId = (req as any).user?.id;
    const message = await scheduledMessageService.createScheduledMessage(createData, userId);
    
    res.status(201).json({
      success: true,
      message: 'Scheduled message created successfully',
      data: message
    });
  } catch (error) {
    console.error('Error creating scheduled message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create scheduled message',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/scheduled-messages/:id
 * Update a scheduled message
 */
router.put('/:id', checkAuth, upload.single('media'), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID'
      });
    }
    
    const { message_text, caption, recipient_phone, start_date, end_date, expire_date, send_times, media_type, status } = req.body;
    
    // Validate dates if provided
    let startDate, endDate, expireDate;
    if (start_date) {
      startDate = new Date(start_date);
      if (startDate <= new Date() && (!status || status === 'pending')) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be in the future for pending messages'
        });
      }
    }
    
    if (end_date) {
      endDate = new Date(end_date);
      if (startDate && endDate < startDate) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }
    }
    
    if (expire_date) {
      expireDate = new Date(expire_date);
      if (startDate && expireDate < startDate) {
        return res.status(400).json({
          success: false,
          message: 'Expire date must be after start date'
        });
      }
    }

    // Validate send times if provided
    if (send_times) {
      if (!Array.isArray(send_times) || send_times.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one send time is required'
        });
      }
      
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      for (const time of send_times) {
        if (!timeRegex.test(time)) {
          return res.status(400).json({
            success: false,
            message: `Invalid time format: ${time}. Use HH:MM format`
          });
        }
      }
    }
    
    const updateData: UpdateScheduledMessageRequest = {};
    
    if (message_text !== undefined) updateData.message_text = message_text;
    if (caption !== undefined) updateData.caption = caption;
    if (recipient_phone !== undefined) updateData.recipient_phone = recipient_phone;
    if (start_date !== undefined) updateData.start_date = startDate?.toISOString().split('T')[0];
    if (end_date !== undefined) updateData.end_date = endDate?.toISOString().split('T')[0];
    if (expire_date !== undefined) updateData.expire_date = expireDate?.toISOString().split('T')[0];
    if (send_times !== undefined) updateData.send_times = send_times;
    if (status !== undefined) updateData.status = status;
    
    // Handle file upload
    if (req.file) {
      updateData.media_path = req.file.path;
      updateData.media_type = media_type || getMediaTypeFromFile(req.file);
    }
    
    const message = await scheduledMessageService.updateScheduledMessage(id, updateData);
    
    res.json({
      success: true,
      message: 'Scheduled message updated successfully',
      data: message
    });
  } catch (error) {
    console.error('Error updating scheduled message:', error);
    if (error instanceof Error && error.message === 'Scheduled message not found') {
      res.status(404).json({
        success: false,
        message: 'Scheduled message not found'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update scheduled message',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

/**
 * DELETE /api/scheduled-messages/:id
 * Delete a scheduled message
 */
router.delete('/:id', checkAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID'
      });
    }
    
    // Get the message first to check if it has a media file
    try {
      const message = await scheduledMessageService.getScheduledMessageById(id);
      
      // Delete the message from database
      const deleted = await scheduledMessageService.deleteScheduledMessage(id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Scheduled message not found'
        });
      }
      
      // Delete associated media file if exists
      if (message.media_path && fs.existsSync(message.media_path)) {
        fs.unlinkSync(message.media_path);
      }
      
      res.json({
        success: true,
        message: 'Scheduled message deleted successfully'
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Scheduled message not found') {
        return res.status(404).json({
          success: false,
          message: 'Scheduled message not found'
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error deleting scheduled message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete scheduled message',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/scheduled-messages/:id/cancel
 * Cancel a scheduled message
 */
router.post('/:id/cancel', checkAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID'
      });
    }
    
    const message = await scheduledMessageService.cancelScheduledMessage(id);
    
    res.json({
      success: true,
      message: 'Scheduled message cancelled successfully',
      data: message
    });
  } catch (error) {
    console.error('Error cancelling scheduled message:', error);
    if (error instanceof Error && error.message === 'Scheduled message not found') {
      res.status(404).json({
        success: false,
        message: 'Scheduled message not found'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to cancel scheduled message',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// Helper function to determine media type from file
function getMediaTypeFromFile(file: Express.Multer.File): string {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
    return 'image';
  } else if (['.mp4', '.avi', '.mov'].includes(ext)) {
    return 'video';
  } else if (['.mp3', '.wav'].includes(ext)) {
    return 'audio';
  } else {
    return 'document';
  }
}

export default router;