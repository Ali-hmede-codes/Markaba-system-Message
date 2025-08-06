import makeWASocket, { DisconnectReason, useMultiFileAuthState, delay, ConnectionState, WASocket } from '@whiskeysockets/baileys';
import * as qrcode from 'qrcode';
import * as fs from 'fs-extra';
import * as path from 'path';
import { EventEmitter } from 'events';

interface Group {
  id: string;
  name: string;
  participants: number;
}

class WhatsAppService extends EventEmitter {
  private socket: WASocket | null = null;
  private qrCode: string | null = null;
  private isConnected: boolean = false;
  private authState: 'DISCONNECTED' | 'CONNECTING' | 'QR_REQUIRED' | 'AUTHENTICATED' | 'READY' = 'DISCONNECTED';
  private favoritesPath: string = path.join(__dirname, '../../../favorites.json');
  private cachePath: string = path.join(__dirname, '../../../cachedGroups.json');
  private cacheMaxAge: number = 5 * 60 * 1000; // 5 minutes
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private isInitializing: boolean = false;

  constructor() {
    super();
  }

  async initialize() {
    try {
      if (this.isInitializing) {
        console.log('Already initializing, skipping...');
        return;
      }

      this.isInitializing = true;

      if (this.socket) {
        try {
          this.socket.end(undefined);
        } catch (err) {
          console.warn('Error ending previous socket:', err);
        }
        this.socket = null;
      }

      this.isConnected = false;
      this.qrCode = null;
      this.updateAuthState('CONNECTING');

      const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, '../../../.wwebjs_auth'));

      // Create a simple logger that has the child method
      const logger = {
        level: 'silent',
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
        child: () => logger
      };

      this.socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        qrTimeout: 60000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        logger: logger,
        markOnlineOnConnect: true,
        browser: ['WhatsApp Bulk Sender', 'Chrome', '1.0.0']
      });

      this.socket.ev.on('creds.update', saveCreds);

      this.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr, isNewLogin } = update;
        console.log('Connection update:', { connection, isNewLogin });

        if (qr) {
          this.updateAuthState('QR_REQUIRED');
          try {
            this.qrCode = await qrcode.toDataURL(qr);
            this.emit('qr', this.qrCode);
            console.log('QR code generated successfully');
            // Auto-expire QR after 10 minutes
            setTimeout(() => {
              if (this.authState === 'QR_REQUIRED') {
                this.qrCode = null;
                console.log('QR code expired');
              }
            }, 600000);
          } catch (err) {
            console.error('Error generating QR:', err);
          }
        }

        if (connection === 'close') {
          this.isInitializing = false;
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                                 statusCode !== DisconnectReason.forbidden &&
                                 this.reconnectAttempts < this.maxReconnectAttempts;
          
          console.log('Connection closed:', {
            error: lastDisconnect?.error?.message,
            statusCode,
            shouldReconnect,
            attempts: this.reconnectAttempts
          });
          
          this.updateAuthState('DISCONNECTED');
          this.isConnected = false;
          this.emit('connection', false);

          if (shouldReconnect) {
            this.reconnectAttempts++;
            const delay = Math.min(30000 * this.reconnectAttempts, 300000); // Max 5 minutes
            console.log(`Reconnecting in ${delay/1000} seconds (attempt ${this.reconnectAttempts})`);
            setTimeout(() => this.initialize(), delay);
          } else {
            if (statusCode === DisconnectReason.loggedOut) {
              console.log('Logged out, clearing auth data');
              await this.clearAuthData();
            }
            this.reconnectAttempts = 0;
          }
        }

        if (connection === 'connecting') {
          this.updateAuthState('CONNECTING');
          console.log('Connecting to WhatsApp...');
        }

        if (connection === 'open') {
          console.log('Connection opened successfully');
          this.updateAuthState('READY');
          this.isConnected = true;
          this.qrCode = null;
          this.reconnectAttempts = 0;
          this.isInitializing = false;
          this.emit('connection', true);
          
          // Wait a bit before allowing group fetching
          setTimeout(() => {
            console.log('WhatsApp ready for operations');
          }, 3000);
        }
      });

    } catch (error) {
      console.error('Error initializing Baileys socket:', error);
      this.updateAuthState('DISCONNECTED');
      this.isInitializing = false;
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.min(10000 * this.reconnectAttempts, 60000);
        console.log(`Retrying initialization in ${delay/1000} seconds...`);
        setTimeout(() => this.initialize(), delay);
      } else {
        console.error('Max initialization attempts reached');
        throw error;
      }
    }
  }

  private updateAuthState(newState: typeof this.authState) {
    const oldState = this.authState;
    this.authState = newState;
    console.log(`Auth state changed: ${oldState} -> ${newState}`);
    this.emit('authStateChanged', { oldState, newState });
  }

  onConnection(callback: (connected: boolean) => void) {
    this.on('connection', callback);
    if (this.isConnected) callback(true);
  }

  onQR(callback: (qr: string) => void) {
    this.on('qr', callback);
    if (this.qrCode) callback(this.qrCode);
  }

  async getGroups(forceRefresh: boolean = false): Promise<Group[]> {
    if (!this.socket) throw new Error('Socket not initialized');

    if (!forceRefresh) {
      try {
        if (await fs.pathExists(this.cachePath)) {
          const cacheData = await fs.readJson(this.cachePath);
          if (Date.now() - cacheData.timestamp < this.cacheMaxAge && Array.isArray(cacheData.groups)) {
            console.log(`Returning ${cacheData.groups.length} cached groups (age: ${Math.round((Date.now() - cacheData.timestamp)/1000)}s)`);
            this.refreshGroupsInBackground();
            return cacheData.groups;
          }
        }
      } catch (err) {
        console.warn('Cache load failed:', err);
        try {
          await fs.remove(this.cachePath);
        } catch (unlinkErr) {
          console.warn('Could not delete corrupted cache:', unlinkErr);
        }
      }
    }

    if (!this.isConnected || this.authState !== 'READY') {
      throw new Error(`WhatsApp not ready (state: ${this.authState})`);
    }

    const maxRetries = 5;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const waitTime = retryCount === 0 ? 15 : (10 + retryCount * 10);
        await delay(waitTime * 1000);

        // Add timeout for the group fetch operation
        const fetchPromise = this.socket.groupFetchAllParticipating();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Group fetch timeout')), 30000);
        });
        
        const groups = await Promise.race([fetchPromise, timeoutPromise]) as any;
        
        if (!groups || typeof groups !== 'object') {
          throw new Error('Invalid response from WhatsApp');
        }

        const formattedGroups: Group[] = Object.values(groups)
          .filter((g: any) => g && g.id && g.id.endsWith('@g.us'))
          .map((g: any) => ({
            id: g.id,
            name: g.subject || 'Unnamed Group',
            participants: Array.isArray(g.participants) ? g.participants.length : 0
          }))
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        try {
          await fs.writeJson(this.cachePath, { timestamp: Date.now(), groups: formattedGroups });
          console.log('Groups cached successfully');
        } catch (cacheErr) {
          console.warn('Failed to cache groups:', cacheErr);
        }
        
        console.log(`Successfully fetched ${formattedGroups.length} groups`);
        return formattedGroups;
      } catch (err) {
        console.error(`Error on attempt ${retryCount + 1}:`, err);
        retryCount++;
        if (retryCount >= maxRetries) {
          // Try to return cached data as fallback if available
          try {
            if (await fs.pathExists(this.cachePath)) {
              const cacheData = await fs.readJson(this.cachePath);
              if (Array.isArray(cacheData.groups)) {
                console.log('Returning stale cached groups as fallback');
                return cacheData.groups;
              }
            }
          } catch (fallbackErr) {
            console.warn('Could not read fallback cache:', fallbackErr);
          }
          throw new Error(`Failed after ${maxRetries} attempts: ${(err as Error).message}`);
        }
      }
    }
    throw new Error('Unexpected error');
  }

  private async refreshGroupsInBackground() {
    try {
      console.log('Starting background refresh');
      await this.getGroups(true);
      console.log('Background refresh completed');
    } catch (err) {
      console.error('Background refresh failed:', err);
    }
  }

  async sendMessages(groupIds: string[], message: string, batchSize: number = 3, mediaBuffer?: Buffer, mediaType?: string, fileName?: string) {
    if (!this.socket) {
      throw new Error('WhatsApp socket not initialized');
    }

    if (!this.isConnected || this.authState !== 'READY') {
      throw new Error(`WhatsApp not ready (state: ${this.authState})`);
    }

    if (!Array.isArray(groupIds) || groupIds.length === 0) {
      throw new Error('No group IDs provided');
    }

    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }

    console.log(`Sending ${mediaBuffer ? 'media ' : ''}message to ${groupIds.length} groups in batches of ${batchSize}`);
    const results = [];
    
    for (let i = 0; i < groupIds.length; i += batchSize) {
      const batch = groupIds.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(groupIds.length/batchSize)}`);
      
      const batchPromises = batch.map(async (groupId) => {
        try {
          // Validate group ID format
          if (!groupId.endsWith('@g.us')) {
            throw new Error('Invalid group ID format');
          }
          
          let messageContent: any;
          
          if (mediaBuffer && mediaType) {
            // Send media message with caption
            if (mediaType.startsWith('image/')) {
              messageContent = {
                image: mediaBuffer,
                caption: message.trim(),
                fileName: fileName || 'image.jpg'
              };
            } else if (mediaType.startsWith('video/')) {
              // Use appropriate default extension based on media type
              let defaultFileName = 'video.mp4';
              if (mediaType.includes('quicktime') || mediaType.includes('mov')) {
                defaultFileName = 'video.mov';
              } else if (mediaType.includes('avi')) {
                defaultFileName = 'video.avi';
              }
              
              messageContent = {
                video: mediaBuffer,
                caption: message.trim(),
                fileName: fileName || defaultFileName
              };
            } else if (mediaType.startsWith('audio/')) {
              messageContent = {
                audio: mediaBuffer,
                fileName: fileName || 'audio.mp3'
              };
              // Send caption as separate text message for audio
              if (message.trim()) {
                await this.socket!.sendMessage(groupId, { text: message.trim() });
              }
            } else {
              // Send as document for other file types
              messageContent = {
                document: mediaBuffer,
                fileName: fileName || 'document',
                caption: message.trim()
              };
            }
          } else {
            // Send text message
            messageContent = { text: message.trim() };
          }
          
          await this.socket!.sendMessage(groupId, messageContent);
          console.log(`✓ ${mediaBuffer ? 'Media m' : 'M'}essage sent to ${groupId}`);
          return { groupId, success: true };
        } catch (error) {
          const errorMessage = (error as Error).message;
          console.error(`✗ Failed to send to ${groupId}:`, errorMessage);
          return { groupId, success: false, error: errorMessage };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Wait between batches to avoid rate limiting
      if (i + batchSize < groupIds.length) {
        console.log('Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`${mediaBuffer ? 'Media m' : 'M'}essage sending completed: ${successCount}/${results.length} successful`);
    return results;
  }

  async shutdown() {
    console.log('Shutting down WhatsApp service...');
    this.isInitializing = false;
    
    if (this.socket) {
      try {
        this.socket.end(undefined);
      } catch (err) {
        console.warn('Error during socket shutdown:', (err as Error).message);
      }
      this.socket = null;
    }
    
    this.isConnected = false;
    this.qrCode = null;
    this.updateAuthState('DISCONNECTED');
    this.reconnectAttempts = 0;
    
    console.log('WhatsApp service shutdown complete');
  }

  // Public methods for routes
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getState(): string {
    return this.authState;
  }

  getQR(): string | null {
    return this.qrCode;
  }

  async clearSession() {
    return await this.clearAuthData();
  }

  async logout() {
    if (!this.socket) return { success: false, message: 'No active session' };
    try {
      await this.socket.logout();
      this.socket.end(new Error('Logged out'));
      this.socket = null;
      this.isConnected = false;
      this.qrCode = null;
      return { success: true, message: 'Logged out' };
    } catch (err) {
      console.error('Logout error:', err);
      return { success: false, message: (err as Error).message };
    }
  }

  async clearAuthData() {
    try {
      await fs.remove(path.join(__dirname, '../../../.wwebjs_auth'));
      this.updateAuthState('DISCONNECTED');
      return { success: true };
    } catch (err) {
      console.error('Clear auth error:', err);
      return { success: false, message: (err as Error).message };
    }
  }

  async saveFavoriteGroups(groups: Group[]) {
    try {
      await fs.writeJSON(this.favoritesPath, { groups });
      return { success: true };
    } catch (err) {
      console.error('Save favorites error:', err);
      return { success: false, error: (err as Error).message };
    }
  }

  async getFavoriteGroups() {
    try {
      if (await fs.pathExists(this.favoritesPath)) {
        const data = await fs.readJSON(this.favoritesPath);
        return { success: true, groups: data.groups || [] };
      }
      return { success: true, groups: [] };
    } catch (err) {
      console.error('Get favorites error:', err);
      return { success: false, error: (err as Error).message, groups: [] };
    }
  }
}

export default new WhatsAppService();