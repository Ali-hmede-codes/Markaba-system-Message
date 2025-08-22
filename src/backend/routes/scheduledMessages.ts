import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();
const SCHEDULED_MESSAGES_FILE = path.join(__dirname, '../../../data/scheduledMessages.json');

// Ensure data directory exists
const dataDir = path.dirname(SCHEDULED_MESSAGES_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize scheduled messages file if it doesn't exist
if (!fs.existsSync(SCHEDULED_MESSAGES_FILE)) {
    fs.writeFileSync(SCHEDULED_MESSAGES_FILE, JSON.stringify([]));
}

interface ScheduledMessage {
    id: number;
    content: string;
    timesPerDay: number;
    startDate: string;
    scheduledTimes: string[];
    status: 'active' | 'paused' | 'inactive';
    createdAt: string;
    updatedAt: string;
    lastSent?: string;
    nextSend?: string;
}

// Helper function to read scheduled messages
function readScheduledMessages(): ScheduledMessage[] {
    try {
        const data = fs.readFileSync(SCHEDULED_MESSAGES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading scheduled messages:', error);
        return [];
    }
}

// Helper function to write scheduled messages
function writeScheduledMessages(messages: ScheduledMessage[]): boolean {
    try {
        fs.writeFileSync(SCHEDULED_MESSAGES_FILE, JSON.stringify(messages, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing scheduled messages:', error);
        return false;
    }
}

// Helper function to generate next ID
function generateNextId(messages: ScheduledMessage[]): number {
    if (messages.length === 0) return 1;
    return Math.max(...messages.map(m => m.id)) + 1;
}

// Helper function to calculate next send time
function calculateNextSendTime(scheduledTimes: string[], startDate: string): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(startDate);
    
    // If start date is in the future, use start date
    if (start > today) {
        const firstTime = scheduledTimes[0];
        const [hours, minutes] = firstTime.split(':').map(Number);
        const nextSend = new Date(start);
        nextSend.setHours(hours, minutes, 0, 0);
        return nextSend.toISOString();
    }
    
    // Find next scheduled time today or tomorrow
    for (const time of scheduledTimes.sort()) {
        const [hours, minutes] = time.split(':').map(Number);
        const scheduledTime = new Date(today);
        scheduledTime.setHours(hours, minutes, 0, 0);
        
        if (scheduledTime > now) {
            return scheduledTime.toISOString();
        }
    }
    
    // All times for today have passed, use first time tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const firstTime = scheduledTimes.sort()[0];
    const [hours, minutes] = firstTime.split(':').map(Number);
    tomorrow.setHours(hours, minutes, 0, 0);
    
    return tomorrow.toISOString();
}

// GET /api/scheduled-messages - Get all scheduled messages
router.get('/', (req: Request, res: Response) => {
    try {
        const messages = readScheduledMessages();
        res.json({
            success: true,
            messages: messages
        });
    } catch (error) {
        console.error('Error fetching scheduled messages:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في تحميل الرسائل المجدولة'
        });
    }
});

// GET /api/scheduled-messages/:id - Get specific scheduled message
router.get('/:id', (req: Request, res: Response) => {
    try {
        const messageId = parseInt(req.params.id);
        const messages = readScheduledMessages();
        const message = messages.find(m => m.id === messageId);
        
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'الرسالة المجدولة غير موجودة'
            });
        }
        
        res.json({
            success: true,
            message: message
        });
    } catch (error) {
        console.error('Error fetching scheduled message:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في تحميل الرسالة المجدولة'
        });
    }
});

// POST /api/scheduled-messages - Create new scheduled message
router.post('/', (req: Request, res: Response) => {
    try {
        const { content, timesPerDay, startDate, scheduledTimes, status = 'active' } = req.body;
        
        // Validation
        if (!content || !timesPerDay || !startDate || !scheduledTimes || scheduledTimes.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'جميع الحقول مطلوبة'
            });
        }
        
        if (scheduledTimes.length !== timesPerDay) {
            return res.status(400).json({
                success: false,
                message: 'عدد الأوقات المحددة لا يتطابق مع عدد المرات في اليوم'
            });
        }
        
        const messages = readScheduledMessages();
        const now = new Date().toISOString();
        
        const newMessage: ScheduledMessage = {
            id: generateNextId(messages),
            content: content.trim(),
            timesPerDay: parseInt(timesPerDay),
            startDate,
            scheduledTimes: scheduledTimes.sort(),
            status,
            createdAt: now,
            updatedAt: now,
            nextSend: status === 'active' ? calculateNextSendTime(scheduledTimes, startDate) : undefined
        };
        
        messages.push(newMessage);
        
        if (writeScheduledMessages(messages)) {
            res.status(201).json({
                success: true,
                message: 'تم إنشاء الرسالة المجدولة بنجاح',
                data: newMessage
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'خطأ في حفظ الرسالة المجدولة'
            });
        }
    } catch (error) {
        console.error('Error creating scheduled message:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في إنشاء الرسالة المجدولة'
        });
    }
});

// PUT /api/scheduled-messages/:id - Update scheduled message
router.put('/:id', (req: Request, res: Response) => {
    try {
        const messageId = parseInt(req.params.id);
        const { content, timesPerDay, startDate, scheduledTimes, status } = req.body;
        
        const messages = readScheduledMessages();
        const messageIndex = messages.findIndex(m => m.id === messageId);
        
        if (messageIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'الرسالة المجدولة غير موجودة'
            });
        }
        
        // Validation
        if (!content || !timesPerDay || !startDate || !scheduledTimes || scheduledTimes.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'جميع الحقول مطلوبة'
            });
        }
        
        if (scheduledTimes.length !== timesPerDay) {
            return res.status(400).json({
                success: false,
                message: 'عدد الأوقات المحددة لا يتطابق مع عدد المرات في اليوم'
            });
        }
        
        const updatedMessage: ScheduledMessage = {
            ...messages[messageIndex],
            content: content.trim(),
            timesPerDay: parseInt(timesPerDay),
            startDate,
            scheduledTimes: scheduledTimes.sort(),
            status,
            updatedAt: new Date().toISOString(),
            nextSend: status === 'active' ? calculateNextSendTime(scheduledTimes, startDate) : undefined
        };
        
        messages[messageIndex] = updatedMessage;
        
        if (writeScheduledMessages(messages)) {
            res.json({
                success: true,
                message: 'تم تحديث الرسالة المجدولة بنجاح',
                data: updatedMessage
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'خطأ في حفظ التحديثات'
            });
        }
    } catch (error) {
        console.error('Error updating scheduled message:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في تحديث الرسالة المجدولة'
        });
    }
});

// PATCH /api/scheduled-messages/:id/toggle - Toggle message status
router.patch('/:id/toggle', (req: Request, res: Response) => {
    try {
        const messageId = parseInt(req.params.id);
        const messages = readScheduledMessages();
        const messageIndex = messages.findIndex(m => m.id === messageId);
        
        if (messageIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'الرسالة المجدولة غير موجودة'
            });
        }
        
        const currentMessage = messages[messageIndex];
        const newStatus = currentMessage.status === 'active' ? 'paused' : 'active';
        
        messages[messageIndex] = {
            ...currentMessage,
            status: newStatus,
            updatedAt: new Date().toISOString(),
            nextSend: newStatus === 'active' ? calculateNextSendTime(currentMessage.scheduledTimes, currentMessage.startDate) : undefined
        };
        
        if (writeScheduledMessages(messages)) {
            res.json({
                success: true,
                message: `تم ${newStatus === 'active' ? 'تفعيل' : 'إيقاف'} الرسالة المجدولة بنجاح`,
                data: messages[messageIndex]
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'خطأ في حفظ التغييرات'
            });
        }
    } catch (error) {
        console.error('Error toggling scheduled message:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في تغيير حالة الرسالة'
        });
    }
});

// DELETE /api/scheduled-messages/:id - Delete scheduled message
router.delete('/:id', (req: Request, res: Response) => {
    try {
        const messageId = parseInt(req.params.id);
        const messages = readScheduledMessages();
        const messageIndex = messages.findIndex(m => m.id === messageId);
        
        if (messageIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'الرسالة المجدولة غير موجودة'
            });
        }
        
        messages.splice(messageIndex, 1);
        
        if (writeScheduledMessages(messages)) {
            res.json({
                success: true,
                message: 'تم حذف الرسالة المجدولة بنجاح'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'خطأ في حذف الرسالة'
            });
        }
    } catch (error) {
        console.error('Error deleting scheduled message:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في حذف الرسالة المجدولة'
        });
    }
});

// GET /api/scheduled-messages/active/next - Get next scheduled messages to send
router.get('/active/next', (req: Request, res: Response) => {
    try {
        const messages = readScheduledMessages();
        const now = new Date();
        
        const nextMessages = messages
            .filter(m => m.status === 'active' && m.nextSend)
            .filter(m => new Date(m.nextSend!) <= now)
            .sort((a, b) => new Date(a.nextSend!).getTime() - new Date(b.nextSend!).getTime());
        
        res.json({
            success: true,
            messages: nextMessages
        });
    } catch (error) {
        console.error('Error fetching next scheduled messages:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في تحميل الرسائل المجدولة التالية'
        });
    }
});

// POST /api/scheduled-messages/:id/sent - Mark message as sent and update next send time
router.post('/:id/sent', (req: Request, res: Response) => {
    try {
        const messageId = parseInt(req.params.id);
        const messages = readScheduledMessages();
        const messageIndex = messages.findIndex(m => m.id === messageId);
        
        if (messageIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'الرسالة المجدولة غير موجودة'
            });
        }
        
        const currentMessage = messages[messageIndex];
        const now = new Date().toISOString();
        
        messages[messageIndex] = {
            ...currentMessage,
            lastSent: now,
            nextSend: calculateNextSendTime(currentMessage.scheduledTimes, currentMessage.startDate),
            updatedAt: now
        };
        
        if (writeScheduledMessages(messages)) {
            res.json({
                success: true,
                message: 'تم تحديث حالة الإرسال بنجاح',
                data: messages[messageIndex]
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'خطأ في حفظ حالة الإرسال'
            });
        }
    } catch (error) {
        console.error('Error marking message as sent:', error);
        res.status(500).json({
            success: false,
            message: 'خطأ في تحديث حالة الإرسال'
        });
    }
});

// GET /api/scheduled-messages/lock-status - Check if message sending is locked
router.get('/lock-status', (req: Request, res: Response) => {
    try {
        const lockFilePath = path.join(__dirname, '../../../data/message-lock.json');
        
        if (!fs.existsSync(lockFilePath)) {
            return res.json({ isLocked: false });
        }
        
        const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
        
        // Check if lock has expired
        if (lockData.lockedUntil && new Date() > new Date(lockData.lockedUntil)) {
            // Lock has expired, remove it
            fs.unlinkSync(lockFilePath);
            return res.json({ isLocked: false });
        }
        
        res.json({
            isLocked: lockData.isLocked || false,
            reason: lockData.reason || '',
            lockedUntil: lockData.lockedUntil || null,
            scheduledMessageId: lockData.scheduledMessageId || null
        });
    } catch (error) {
        console.error('Error checking lock status:', error);
        res.status(500).json({ error: 'Failed to check lock status' });
    }
});

export default router;