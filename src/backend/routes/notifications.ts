import express from 'express';
import path from 'path';
import fs from 'fs';

const router = express.Router();

interface Notification {
    id: string;
    type: 'scheduled_message_alert' | 'info' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
    scheduledMessageId?: string;
    timeUntilSend?: number; // seconds until message is sent
}

const NOTIFICATIONS_FILE = path.join(__dirname, '../../data/notifications.json');

// Ensure data directory exists
const dataDir = path.dirname(NOTIFICATIONS_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

function readNotifications(): Notification[] {
    try {
        if (!fs.existsSync(NOTIFICATIONS_FILE)) {
            return [];
        }
        const data = fs.readFileSync(NOTIFICATIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading notifications:', error);
        return [];
    }
}

function writeNotifications(notifications: Notification[]): void {
    try {
        fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
    } catch (error) {
        console.error('Error writing notifications:', error);
    }
}

function generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// Get all notifications
router.get('/', (req, res) => {
    try {
        const notifications = readNotifications();
        // Sort by timestamp (newest first)
        notifications.sort((a, b) => b.timestamp - a.timestamp);
        res.json({ success: true, notifications });
    } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({ success: false, error: 'Failed to get notifications' });
    }
});

// Get unread notifications count
router.get('/unread-count', (req, res) => {
    try {
        const notifications = readNotifications();
        const unreadCount = notifications.filter(n => !n.read).length;
        res.json({ success: true, unreadCount });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ success: false, error: 'Failed to get unread count' });
    }
});

// Mark notification as read
router.patch('/:id/read', (req, res) => {
    try {
        const { id } = req.params;
        const notifications = readNotifications();
        
        const notification = notifications.find(n => n.id === id);
        if (!notification) {
            return res.status(404).json({ success: false, error: 'Notification not found' });
        }
        
        notification.read = true;
        writeNotifications(notifications);
        
        res.json({ success: true, notification });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
    }
});

// Mark all notifications as read
router.patch('/mark-all-read', (req, res) => {
    try {
        const notifications = readNotifications();
        
        notifications.forEach(n => n.read = true);
        writeNotifications(notifications);
        
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' });
    }
});

// Delete notification
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        let notifications = readNotifications();
        
        const initialLength = notifications.length;
        notifications = notifications.filter(n => n.id !== id);
        
        if (notifications.length === initialLength) {
            return res.status(404).json({ success: false, error: 'Notification not found' });
        }
        
        writeNotifications(notifications);
        
        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ success: false, error: 'Failed to delete notification' });
    }
});

// Clear old notifications (older than 7 days)
router.delete('/cleanup/old', (req, res) => {
    try {
        const notifications = readNotifications();
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        const filteredNotifications = notifications.filter(n => n.timestamp > sevenDaysAgo);
        writeNotifications(filteredNotifications);
        
        const deletedCount = notifications.length - filteredNotifications.length;
        
        res.json({ 
            success: true, 
            message: `Deleted ${deletedCount} old notifications`,
            deletedCount 
        });
    } catch (error) {
        console.error('Error cleaning up old notifications:', error);
        res.status(500).json({ success: false, error: 'Failed to cleanup old notifications' });
    }
});

// Function to create a new notification (used by other services)
export function createNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void {
    try {
        const notifications = readNotifications();
        
        const newNotification: Notification = {
            ...notification,
            id: generateId(),
            timestamp: Date.now(),
            read: false
        };
        
        notifications.push(newNotification);
        writeNotifications(notifications);
        
        console.log(`Created notification: ${newNotification.title}`);
    } catch (error) {
        console.error('Error creating notification:', error);
    }
}

export default router;