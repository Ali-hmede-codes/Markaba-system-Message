import cron from 'node-cron';
import * as fs from 'fs';
import * as path from 'path';
import { createNotification } from '../routes/notifications';
import whatsappService from './whatsappService';
import telegramService from './telegramService';
import databaseService from './databaseService';

const SCHEDULED_MESSAGES_FILE = path.join(__dirname, '../../../data/scheduledMessages.json');
const SETTINGS_FILE = path.join(__dirname, '../../../settings.json');
const LOCK_FILE = path.join(__dirname, '../../../data/messageLock.json');

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

interface MessageLock {
    isLocked: boolean;
    lockedUntil?: string;
    reason?: string;
    scheduledMessageId?: number;
}

interface Settings {
    scheduleMessages?: boolean;
    sendToTelegram?: boolean;
    sendToWhatsApp?: boolean;
    [key: string]: any;
}

class SchedulingService {
    private cronJob: any | null = null;
    private isInitialized = false;

    constructor() {
        this.ensureDataDirectory();
        this.ensureLockFile();
    }

    private ensureDataDirectory(): void {
        const dataDir = path.dirname(SCHEDULED_MESSAGES_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    private ensureLockFile(): void {
        if (!fs.existsSync(LOCK_FILE)) {
            const initialLock: MessageLock = { isLocked: false };
            fs.writeFileSync(LOCK_FILE, JSON.stringify(initialLock, null, 2));
        }
    }

    private readScheduledMessages(): ScheduledMessage[] {
        try {
            if (!fs.existsSync(SCHEDULED_MESSAGES_FILE)) {
                return [];
            }
            const data = fs.readFileSync(SCHEDULED_MESSAGES_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading scheduled messages:', error);
            return [];
        }
    }

    private writeScheduledMessages(messages: ScheduledMessage[]): boolean {
        try {
            fs.writeFileSync(SCHEDULED_MESSAGES_FILE, JSON.stringify(messages, null, 2));
            return true;
        } catch (error) {
            console.error('Error writing scheduled messages:', error);
            return false;
        }
    }

    private readSettings(): Settings {
        try {
            if (!fs.existsSync(SETTINGS_FILE)) {
                return {};
            }
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading settings:', error);
            return {};
        }
    }

    private readMessageLock(): MessageLock {
        try {
            const data = fs.readFileSync(LOCK_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading message lock:', error);
            return { isLocked: false };
        }
    }

    private writeMessageLock(lock: MessageLock): boolean {
        try {
            fs.writeFileSync(LOCK_FILE, JSON.stringify(lock, null, 2));
            return true;
        } catch (error) {
            console.error('Error writing message lock:', error);
            return false;
        }
    }

    private lockMessageSending(messageId: number): void {
        const lock: MessageLock = {
            isLocked: true,
            reason: 'scheduled_message_sending',
            scheduledMessageId: messageId
        };

        this.writeMessageLock(lock);
        console.log(`Message sending locked due to scheduled message ${messageId}`);
    }

    private unlockMessageSending(): void {
        const lock: MessageLock = { isLocked: false };
        this.writeMessageLock(lock);
        console.log('Message sending unlocked');
    }

    public isMessageSendingLocked(): boolean {
        const lock = this.readMessageLock();
        if (!lock.isLocked) {
            return false;
        }

        if (lock.lockedUntil) {
            const lockUntil = new Date(lock.lockedUntil);
            const now = new Date();
            if (now >= lockUntil) {
                // Lock has expired, unlock it
                this.unlockMessageSending();
                return false;
            }
        }

        return true;
    }

    private calculateNextSendTime(scheduledTimes: string[], startDate: string): string | undefined {
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

    private async sendScheduledMessage(message: ScheduledMessage): Promise<boolean> {
        try {
            const settings = this.readSettings();
            let success = false;

            console.log(`Preparing to send scheduled message ${message.id}: "${message.content.substring(0, 50)}..."`);            
            
            // Get notification time from settings (default 30 seconds)
            const notificationTime = settings.notificationTime || 30;
            
            // Create notification before sending
            createNotification({
                type: 'scheduled_message_alert',
                title: 'Scheduled Message Alert',
                message: `A scheduled message will be sent in ${notificationTime} seconds: "${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}}". Message sending will be locked during this time.`,
                scheduledMessageId: message.id.toString(),
                timeUntilSend: notificationTime
            });
            
            // Wait for notification period
            await new Promise(resolve => setTimeout(resolve, notificationTime * 1000));

            // Lock message sending before sending
            this.lockMessageSending(message.id);

            // Get all users from database
            const users = await databaseService.query('SELECT * FROM users WHERE is_active = 1');
            
            if (!users || users.length === 0) {
                console.log('No users found to send scheduled message to');
                this.unlockMessageSending();
                return false;
            }

            let whatsappSuccess = false;
            let telegramSuccess = false;

            // Send to WhatsApp if enabled
            if (settings.sendToWhatsApp) {
                try {
                    const phoneNumbers = users.filter((user: any) => user.phone).map((user: any) => user.phone);
                    if (phoneNumbers.length > 0) {
                        await whatsappService.sendMessages(phoneNumbers, message.content);
                        console.log(`✓ Scheduled message sent successfully to ${phoneNumbers.length} WhatsApp numbers`);
                        whatsappSuccess = true;
                    }
                } catch (error) {
                    console.error('✗ Error sending scheduled message via WhatsApp:', error);
                }
            }

            // Send to Telegram if enabled
            if (settings.sendToTelegram) {
                try {
                    for (const user of users) {
                        if ((user as any).telegram_id) {
                            await telegramService.sendMessage(message.content);
                            console.log(`✓ Scheduled message sent successfully to Telegram: ${(user as any).telegram_id}`);
                        }
                    }
                    telegramSuccess = true;
                } catch (error) {
                    console.error('✗ Error sending scheduled message via Telegram:', error);
                }
            }

            // Determine overall success
            success = (settings.sendToWhatsApp ? whatsappSuccess : true) && (settings.sendToTelegram ? telegramSuccess : true);

            // Unlock message sending immediately after delivery attempt
            this.unlockMessageSending();
            
            if (success) {
                console.log(`✓ Scheduled message ${message.id} sent successfully and unlocked immediately`);
            } else {
                console.log(`✗ Scheduled message ${message.id} failed to send, but unlocked for retry`);
            }

            return success;
        } catch (error) {
            console.error('Error in sendScheduledMessage:', error);
            this.unlockMessageSending();
            return false;
        }
    }

    private async processScheduledMessages(): Promise<void> {
        try {
            const settings = this.readSettings();
            
            // Check if scheduled messages are enabled
            if (!settings.scheduleMessages) {
                return;
            }

            // Check if message sending is currently locked
            if (this.isMessageSendingLocked()) {
                console.log('Message sending is locked, skipping scheduled message processing');
                return;
            }

            const messages = this.readScheduledMessages();
            const now = new Date();

            // Find messages that need to be sent
            const messagesToSend = messages.filter(message => {
                if (message.status !== 'active' || !message.nextSend) {
                    return false;
                }

                const nextSendTime = new Date(message.nextSend);
                return nextSendTime <= now;
            });

            // Process each message
            for (const message of messagesToSend) {
                try {
                    const success = await this.sendScheduledMessage(message);
                    
                    if (success) {
                        // Update message with last sent time and calculate next send time
                        const updatedMessages = this.readScheduledMessages();
                        const messageIndex = updatedMessages.findIndex(m => m.id === message.id);
                        
                        if (messageIndex !== -1) {
                            const now = new Date().toISOString();
                            updatedMessages[messageIndex] = {
                                ...updatedMessages[messageIndex],
                                lastSent: now,
                                nextSend: this.calculateNextSendTime(message.scheduledTimes, message.startDate),
                                updatedAt: now
                            };
                            
                            this.writeScheduledMessages(updatedMessages);
                            console.log(`Scheduled message ${message.id} sent successfully and updated`);
                        }
                    } else {
                        console.error(`Failed to send scheduled message ${message.id}`);
                    }
                } catch (error) {
                    console.error(`Error processing scheduled message ${message.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error in processScheduledMessages:', error);
        }
    }

    public initialize(): void {
        if (this.isInitialized) {
            console.log('Scheduling service already initialized');
            return;
        }

        try {
            // Run every minute to check for scheduled messages
            this.cronJob = cron.schedule('* * * * *', async () => {
                await this.processScheduledMessages();
            });

            this.cronJob.start();
            this.isInitialized = true;
            console.log('Scheduling service initialized and started');
        } catch (error) {
            console.error('Error initializing scheduling service:', error);
        }
    }

    public stop(): void {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            this.isInitialized = false;
            console.log('Scheduling service stopped');
        }
    }

    public restart(): void {
        this.stop();
        this.initialize();
    }

    public getStatus(): { isRunning: boolean; isLocked: boolean; lockInfo?: MessageLock } {
        const lock = this.readMessageLock();
        return {
            isRunning: this.isInitialized && this.cronJob !== null,
            isLocked: this.isMessageSendingLocked(),
            lockInfo: lock.isLocked ? lock : undefined
        };
    }

    // Method to manually trigger message processing (for testing)
    public async processNow(): Promise<void> {
        console.log('Manually triggering scheduled message processing');
        await this.processScheduledMessages();
    }

    // Method to check if message sending should be blocked
    public isMessageBlocked(): boolean {
        return this.isMessageSendingLocked();
    }

    // Method to get lock information
    public getLockInfo(): MessageLock {
        return this.readMessageLock();
    }
}

// Create and export singleton instance
const schedulingService = new SchedulingService();
export default schedulingService;