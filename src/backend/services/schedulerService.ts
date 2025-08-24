import scheduledMessageService from './scheduledMessageService';
import whatsappService from './whatsappService';
import favoritesService from './favoritesService';
import fs from 'fs';
import path from 'path';

class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isProcessing: boolean = false;
  private checkInterval: number = 60000; // Default 1 minute
  
  constructor() {
    this.loadSettings();
  }
  
  /**
   * Load settings from settings.json
   */
  private loadSettings(): void {
    try {
      const settingsPath = path.join(process.cwd(), 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        
        if (settings.scheduledMessageSettings) {
          this.checkInterval = settings.scheduledMessageSettings.checkInterval || 60000;
        }
      }
    } catch (error) {
      console.error('Error loading scheduler settings:', error);
    }
  }
  
  /**
   * Check if scheduled messages feature is enabled
   */
  private isScheduledMessagesEnabled(): boolean {
    try {
      const settingsPath = path.join(process.cwd(), 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        return settings.scheduledMessages === true && 
               settings.scheduledMessageSettings?.enabled === true;
      }
    } catch (error) {
      console.error('Error checking scheduled messages settings:', error);
    }
    return false;
  }
  
  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }
    
    if (!this.isScheduledMessagesEnabled()) {
      console.log('Scheduled messages feature is disabled');
      return;
    }
    
    console.log(`Starting scheduled message scheduler with ${this.checkInterval}ms interval`);
    
    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.processScheduledMessages();
    }, this.checkInterval);
    
    // Process immediately on start
    this.processScheduledMessages();
  }
  
  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('Scheduler is not running');
      return;
    }
    
    console.log('Stopping scheduled message scheduler');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
  }
  
  /**
   * Restart the scheduler (useful when settings change)
   */
  restart(): void {
    this.stop();
    this.loadSettings();
    this.start();
  }
  
  /**
   * Process pending scheduled messages sequentially
   */
  private async processScheduledMessages(): Promise<void> {
    if (this.isProcessing) {
      console.log('Already processing scheduled messages, skipping this cycle');
      return;
    }
    
    try {
      if (!this.isScheduledMessagesEnabled()) {
        this.stop();
        return;
      }
      
      this.isProcessing = true;
      
      const pendingMessageSends = await scheduledMessageService.getPendingMessageSends();
      
      if (pendingMessageSends.length === 0) {
        return;
      }
      
      console.log(`Processing ${pendingMessageSends.length} pending scheduled message sends`);
      
      // Process messages sequentially to avoid conflicts
      for (const messageSend of pendingMessageSends) {
        try {
          await this.sendScheduledMessageSend(messageSend);
          
          // Add a small delay between messages to prevent overwhelming the WhatsApp service
          await this.delay(1000); // 1 second delay
        } catch (error) {
          console.error(`Error processing scheduled message send ${messageSend.id}:`, error);
        }
      }
    } catch (error) {
      // Handle database connection errors gracefully
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        console.warn('Database connection refused - scheduled messages temporarily unavailable');
      } else {
        console.error('Error processing scheduled messages:', error);
      }
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Send a single scheduled message send
   */
  private async sendScheduledMessageSend(messageSend: any): Promise<void> {
    try {
      console.log(`Sending scheduled message send ${messageSend.id} to ${messageSend.recipient_phone}`);
      
      // Mark as processing
      await scheduledMessageService.markSendAsProcessing(messageSend.id);
      
      const allGroupIds = messageSend.recipient_phone.split(',').map((id: string) => id.trim());
      
      // Filter to only include favorite groups
      const groupIds = await favoritesService.filterFavoriteGroups(allGroupIds);
      
      if (groupIds.length === 0) {
        throw new Error('No favorite groups found in recipient list');
      }
      
      if (groupIds.length < allGroupIds.length) {
        console.warn(`Filtered out ${allGroupIds.length - groupIds.length} non-favorite groups from message send ${messageSend.id}`);
      }
      
      // Handle media message
      if (messageSend.media_path && fs.existsSync(messageSend.media_path)) {
        const mediaBuffer = fs.readFileSync(messageSend.media_path);
        const fileName = path.basename(messageSend.media_path);
        
        await whatsappService.sendMessages(
          groupIds,
          messageSend.message_text || messageSend.caption || '',
          3, // batch size
          mediaBuffer,
          messageSend.media_type || 'application/octet-stream',
          fileName
        );
      }
      // Handle text-only message
      else if (messageSend.message_text) {
        await whatsappService.sendMessages(groupIds, messageSend.message_text);
      }
      else {
        throw new Error('No message content provided');
      }
      
      // Mark as sent
      await scheduledMessageService.markSendAsSent(messageSend.id);
      console.log(`Successfully sent scheduled message send ${messageSend.id}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to send scheduled message send ${messageSend.id}:`, errorMessage);
      
      // Mark as failed
      await scheduledMessageService.markSendAsFailed(messageSend.id, errorMessage);
    }
  }
  
  /**
   * Utility function to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get scheduler status
   */
  getStatus(): { isRunning: boolean; isProcessing: boolean; checkInterval: number; enabled: boolean } {
    return {
      isRunning: this.isRunning,
      isProcessing: this.isProcessing,
      checkInterval: this.checkInterval,
      enabled: this.isScheduledMessagesEnabled()
    };
  }
}

export default new SchedulerService();