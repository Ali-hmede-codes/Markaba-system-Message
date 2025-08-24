import fs from 'fs-extra';
import path from 'path';
import databaseService from './databaseService';

class CleanupService {
  private isRunning: boolean = false;
  private cleanupInterval: number = 24 * 60 * 60 * 1000; // Default 24 hours
  private intervalId: NodeJS.Timeout | null = null;
  private enabled: boolean = true;
  
  constructor() {
    this.loadSettings();
  }
  
  /**
   * Load cleanup settings from settings.json
   */
  private loadSettings(): void {
    try {
      const settingsPath = path.join(process.cwd(), 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        
        if (settings.cleanupSettings) {
          this.cleanupInterval = settings.cleanupSettings.interval || this.cleanupInterval;
          this.enabled = settings.cleanupSettings.enabled !== false;
        }
      }
    } catch (error) {
      console.error('Error loading cleanup settings:', error);
    }
  }
  
  /**
   * Start the cleanup service
   */
  start(): void {
    if (this.isRunning) {
      console.log('Cleanup service is already running');
      return;
    }
    
    if (!this.enabled) {
      console.log('Cleanup service is disabled');
      return;
    }
    
    console.log(`Starting cleanup service with ${this.cleanupInterval}ms interval`);
    
    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.performCleanup();
    }, this.cleanupInterval);
    
    // Perform initial cleanup on start
    this.performCleanup();
  }
  
  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('Cleanup service is not running');
      return;
    }
    
    console.log('Stopping cleanup service');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
  }
  
  /**
   * Restart the cleanup service
   */
  restart(): void {
    this.stop();
    this.loadSettings();
    this.start();
  }
  
  /**
   * Perform cleanup of expired messages and media files
   */
  async performCleanup(): Promise<void> {
    try {
      console.log('Starting cleanup process...');
      
      const cleanupStats = {
        expiredMessages: 0,
        deletedMediaFiles: 0,
        freedStorage: 0,
        errors: 0
      };
      
      // Get expired messages
      const expiredMessages = await this.getExpiredMessages();
      
      if (expiredMessages.length === 0) {
        console.log('No expired messages found');
        return;
      }
      
      console.log(`Found ${expiredMessages.length} expired messages to clean up`);
      
      // Process each expired message
      for (const message of expiredMessages) {
        try {
          // Delete media files if they exist
          if (message.media_path) {
            const mediaDeleted = await this.deleteMediaFiles(message.media_path);
            if (mediaDeleted.success) {
              cleanupStats.deletedMediaFiles += mediaDeleted.filesDeleted;
              cleanupStats.freedStorage += mediaDeleted.bytesFreed;
            }
          }
          
          // Delete message from database
          await this.deleteExpiredMessage(message.id);
          cleanupStats.expiredMessages++;
          
        } catch (error) {
          console.error(`Error cleaning up message ${message.id}:`, error);
          cleanupStats.errors++;
        }
      }
      
      // Log cleanup results
      console.log('Cleanup completed:', {
        expiredMessages: cleanupStats.expiredMessages,
        deletedMediaFiles: cleanupStats.deletedMediaFiles,
        freedStorageMB: Math.round(cleanupStats.freedStorage / (1024 * 1024) * 100) / 100,
        errors: cleanupStats.errors
      });
      
    } catch (error) {
      console.error('Error during cleanup process:', error);
    }
  }
  
  /**
   * Get expired messages from database
   */
  private async getExpiredMessages(): Promise<any[]> {
    try {
      const [rows] = await databaseService.query(
        `SELECT id, media_path, media_type 
         FROM scheduled_messages 
         WHERE expire_date < CURDATE() 
         AND status IN ('pending', 'sent', 'failed')`,
        []
      );
      
      return rows as any[];
    } catch (error) {
      console.error('Error fetching expired messages:', error);
      return [];
    }
  }
  
  /**
   * Delete media files associated with a message
   */
  private async deleteMediaFiles(mediaPath: string): Promise<{success: boolean, filesDeleted: number, bytesFreed: number}> {
    let filesDeleted = 0;
    let bytesFreed = 0;
    
    try {
      // Get the directory containing the media file
      const mediaDir = path.dirname(mediaPath);
      
      // Check if the specific media file exists
      if (await fs.pathExists(mediaPath)) {
        const stats = await fs.stat(mediaPath);
        bytesFreed += stats.size;
        await fs.remove(mediaPath);
        filesDeleted++;
        console.log(`Deleted media file: ${mediaPath}`);
      }
      
      // Check if the entire directory can be removed (if it's a message-specific directory)
      if (await fs.pathExists(mediaDir)) {
        const dirContents = await fs.readdir(mediaDir);
        
        // If directory is empty or only contains the file we just deleted, remove the directory
        if (dirContents.length === 0) {
          await fs.remove(mediaDir);
          console.log(`Deleted empty media directory: ${mediaDir}`);
        }
      }
      
      return { success: true, filesDeleted, bytesFreed };
      
    } catch (error) {
      console.error(`Error deleting media files for path ${mediaPath}:`, error);
      return { success: false, filesDeleted, bytesFreed };
    }
  }
  
  /**
   * Delete expired message from database
   */
  private async deleteExpiredMessage(messageId: number): Promise<void> {
    try {
      // Delete from scheduled_message_sends first (due to foreign key constraint)
      await databaseService.query(
        'DELETE FROM scheduled_message_sends WHERE scheduled_message_id = ?',
        [messageId]
      );
      
      // Delete from scheduled_messages
      await databaseService.query(
        'DELETE FROM scheduled_messages WHERE id = ?',
        [messageId]
      );
      
      console.log(`Deleted expired message ${messageId} from database`);
      
    } catch (error) {
      console.error(`Error deleting expired message ${messageId} from database:`, error);
      throw error;
    }
  }
  
  /**
   * Manual cleanup trigger (for API endpoint)
   */
  async triggerManualCleanup(): Promise<{success: boolean, message: string}> {
    try {
      await this.performCleanup();
      return {
        success: true,
        message: 'Manual cleanup completed successfully'
      };
    } catch (error) {
      console.error('Manual cleanup failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error during cleanup'
      };
    }
  }
  
  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<{totalExpired: number, estimatedStorageToFree: number}> {
    try {
      const expiredMessages = await this.getExpiredMessages();
      let estimatedStorage = 0;
      
      // Calculate estimated storage that can be freed
      for (const message of expiredMessages) {
        if (message.media_path && await fs.pathExists(message.media_path)) {
          try {
            const stats = await fs.stat(message.media_path);
            estimatedStorage += stats.size;
          } catch (error) {
            // File might not exist, skip
          }
        }
      }
      
      return {
        totalExpired: expiredMessages.length,
        estimatedStorageToFree: estimatedStorage
      };
      
    } catch (error) {
      console.error('Error getting cleanup stats:', error);
      return { totalExpired: 0, estimatedStorageToFree: 0 };
    }
  }
}

export default new CleanupService();