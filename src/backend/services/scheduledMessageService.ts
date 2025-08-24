import databaseService from './databaseService';
import favoritesService from './favoritesService';
import { ScheduledMessage, ScheduledMessageSend, CreateScheduledMessageRequest, UpdateScheduledMessageRequest, ScheduledMessageFilter, ScheduledMessageStats } from '../types/scheduledMessage';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

class ScheduledMessageService {
  /**
   * Create a new scheduled message and generate individual sends
   */
  async createScheduledMessage(data: CreateScheduledMessageRequest, userId?: number): Promise<ScheduledMessage> {
    // Validate that all recipient groups are favorites
    const recipientIds = data.recipient_phone.split(',').map(id => id.trim());
    const validation = await favoritesService.validateAllFavorites(recipientIds);
    
    if (!validation.valid) {
      throw new Error(`The following group IDs are not in favorites: ${validation.invalidIds.join(', ')}. Only favorite groups are allowed for scheduled messages.`);
    }
    
    const connection = await databaseService.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Insert the main scheduled message
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO scheduled_messages 
         (message_text, media_path, media_type, caption, recipient_phone, start_date, end_date, expire_date, send_times, user_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.message_text || null,
          data.media_path || null,
          data.media_type || null,
          data.caption || null,
          data.recipient_phone,
          data.start_date,
          data.end_date,
          data.expire_date,
          JSON.stringify(data.send_times),
          userId || null
        ]
      );
      
      const messageId = result.insertId;
      
      // Generate individual message sends for each date and time combination
      await this.generateMessageSends(connection, messageId, data.start_date, data.end_date, data.send_times);
      
      await connection.commit();
      
      // Return the created message
      return await this.getScheduledMessageById(messageId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Generate individual message sends for date range and times
   */
  private async generateMessageSends(connection: any, messageId: number, startDate: string, endDate: string, sendTimes: string[]): Promise<void> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const sends = [];
    
    // Generate sends for each date in the range
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      
      // Generate sends for each time
      for (const time of sendTimes) {
        sends.push([messageId, dateStr, time]);
      }
    }
    
    if (sends.length > 0) {
      const placeholders = sends.map(() => '(?, ?, ?)').join(', ');
      const values = sends.flat();
      
      await connection.execute(
        `INSERT INTO scheduled_message_sends (scheduled_message_id, send_date, send_time) VALUES ${placeholders}`,
        values
      );
    }
  }
  
  /**
   * Get scheduled message by ID
   */
  async getScheduledMessageById(id: number): Promise<ScheduledMessage> {
    const [rows] = await databaseService.query(
      'SELECT * FROM scheduled_messages WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      throw new Error('Scheduled message not found');
    }
    
    const message = rows[0] as ScheduledMessage;
    message.send_times = JSON.parse(message.send_times as any);
    
    return message;
  }
  
  /**
   * Get all scheduled messages with optional filtering
   */
  async getScheduledMessages(filter: ScheduledMessageFilter = {}): Promise<ScheduledMessage[]> {
    let query = 'SELECT * FROM scheduled_messages WHERE 1=1';
    const params: any[] = [];
    
    if (filter.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }
    
    if (filter.recipient_phone) {
      query += ' AND recipient_phone = ?';
      params.push(filter.recipient_phone);
    }
    
    if (filter.start_date_from) {
      query += ' AND start_date >= ?';
      params.push(filter.start_date_from);
    }
    
    if (filter.start_date_to) {
      query += ' AND start_date <= ?';
      params.push(filter.start_date_to);
    }
    
    if (filter.end_date_from) {
      query += ' AND end_date >= ?';
      params.push(filter.end_date_from);
    }
    
    if (filter.end_date_to) {
      query += ' AND end_date <= ?';
      params.push(filter.end_date_to);
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (filter.limit) {
      query += ' LIMIT ?';
      params.push(filter.limit);
      
      if (filter.offset) {
        query += ' OFFSET ?';
        params.push(filter.offset);
      }
    }
    
    const [rows] = await databaseService.query(query, params);
    
    return (rows as any[]).map((row: any) => {
      const message = row as ScheduledMessage;
      message.send_times = JSON.parse(message.send_times as any);
      return message;
    });
  }
  
  /**
   * Get pending message sends that are ready to be sent
   */
  async getPendingMessageSends(): Promise<ScheduledMessageSend[]> {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM format
    
    const [rows] = await databaseService.query(
      `SELECT sms.*, sm.message_text, sm.media_path, sm.media_type, sm.caption, sm.recipient_phone, sm.expire_date
       FROM scheduled_message_sends sms
       JOIN scheduled_messages sm ON sms.scheduled_message_id = sm.id
       WHERE sms.status = 'pending'
       AND sms.send_date <= ?
       AND sms.send_time <= ?
       AND sm.expire_date >= ?
       AND sm.status = 'pending'
       ORDER BY sms.send_date ASC, sms.send_time ASC`,
      [currentDate, currentTime, currentDate]
    );
    
    return rows as ScheduledMessageSend[];
  }
  
  /**
   * Update a scheduled message
   */
  async updateScheduledMessage(id: number, data: UpdateScheduledMessageRequest): Promise<ScheduledMessage> {
    // Validate recipient_phone if it's being updated
    if (data.recipient_phone !== undefined) {
      const recipientIds = data.recipient_phone.split(',').map(id => id.trim());
      const validation = await favoritesService.validateAllFavorites(recipientIds);
      
      if (!validation.valid) {
        throw new Error(`The following group IDs are not in favorites: ${validation.invalidIds.join(', ')}. Only favorite groups are allowed for scheduled messages.`);
      }
    }
    
    const connection = await databaseService.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const updateFields: string[] = [];
      const params: any[] = [];
      
      if (data.message_text !== undefined) {
        updateFields.push('message_text = ?');
        params.push(data.message_text);
      }
      
      if (data.media_path !== undefined) {
        updateFields.push('media_path = ?');
        params.push(data.media_path);
      }
      
      if (data.media_type !== undefined) {
        updateFields.push('media_type = ?');
        params.push(data.media_type);
      }
      
      if (data.caption !== undefined) {
        updateFields.push('caption = ?');
        params.push(data.caption);
      }
      
      if (data.recipient_phone !== undefined) {
        updateFields.push('recipient_phone = ?');
        params.push(data.recipient_phone);
      }
      
      if (data.status !== undefined) {
        updateFields.push('status = ?');
        params.push(data.status);
      }
      
      // Handle date and time updates
      let regenerateSends = false;
      
      if (data.start_date !== undefined) {
        updateFields.push('start_date = ?');
        params.push(data.start_date);
        regenerateSends = true;
      }
      
      if (data.end_date !== undefined) {
        updateFields.push('end_date = ?');
        params.push(data.end_date);
        regenerateSends = true;
      }
      
      if (data.expire_date !== undefined) {
        updateFields.push('expire_date = ?');
        params.push(data.expire_date);
      }
      
      if (data.send_times !== undefined) {
        updateFields.push('send_times = ?');
        params.push(JSON.stringify(data.send_times));
        regenerateSends = true;
      }
      
      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }
      
      params.push(id);
      
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE scheduled_messages SET ${updateFields.join(', ')} WHERE id = ?`,
        params
      );
      
      if (result.affectedRows === 0) {
        throw new Error('Scheduled message not found');
      }
      
      // Regenerate message sends if dates or times changed
      if (regenerateSends) {
        // Delete existing pending sends
        await connection.execute(
          'DELETE FROM scheduled_message_sends WHERE scheduled_message_id = ? AND status = "pending"',
          [id]
        );
        
        // Get updated message data
        const [messageRows] = await connection.execute(
          'SELECT start_date, end_date, send_times FROM scheduled_messages WHERE id = ?',
          [id]
        );
        
        if ((messageRows as any[]).length > 0) {
          const message = (messageRows as any[])[0];
          const sendTimes = JSON.parse(message.send_times);
          await this.generateMessageSends(connection, id, message.start_date, message.end_date, sendTimes);
        }
      }
      
      await connection.commit();
      
      return await this.getScheduledMessageById(id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  
  /**
   * Delete scheduled message
   */
  async deleteScheduledMessage(id: number): Promise<boolean> {
    const [result] = await databaseService.query(
      'DELETE FROM scheduled_messages WHERE id = ?',
      [id]
    );
    
    return result.affectedRows > 0;
  }
  
  /**
   * Cancel scheduled message
   */
  async cancelScheduledMessage(id: number): Promise<ScheduledMessage> {
    const [result] = await databaseService.query(
      'UPDATE scheduled_messages SET status = "cancelled" WHERE id = ? AND status = "pending"',
      [id]
    );
    
    if (result.affectedRows === 0) {
      throw new Error('Scheduled message not found or already processed');
    }
    
    // Cancel all pending sends
    await databaseService.query(
      'UPDATE scheduled_message_sends SET status = "failed", error_message = "Message cancelled" WHERE scheduled_message_id = ? AND status = "pending"',
      [id]
    );
    
    return await this.getScheduledMessageById(id);
  }
  
  /**
   * Mark message send as processing
   */
  async markSendAsProcessing(sendId: number): Promise<void> {
    await databaseService.query(
      'UPDATE scheduled_message_sends SET status = "processing" WHERE id = ?',
      [sendId]
    );
  }
  
  /**
   * Mark message send as sent
   */
  async markSendAsSent(sendId: number): Promise<void> {
    await databaseService.query(
      'UPDATE scheduled_message_sends SET status = "sent", sent_at = NOW() WHERE id = ?',
      [sendId]
    );
  }
  
  /**
   * Mark message send as failed
   */
  async markSendAsFailed(sendId: number, errorMessage: string): Promise<void> {
    await databaseService.query(
      'UPDATE scheduled_message_sends SET status = "failed", error_message = ? WHERE id = ?',
      [errorMessage, sendId]
    );
  }
  
  /**
   * Get statistics about scheduled messages
   */
  async getStats(): Promise<ScheduledMessageStats> {
    const [messageStats] = await databaseService.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
       FROM scheduled_messages`
    );
    
    const [sendStats] = await databaseService.query(
      `SELECT 
         COUNT(*) as total_sends,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_sends,
         SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_sends,
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_sends,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_sends
       FROM scheduled_message_sends`
    );
    
    return {
      total: messageStats[0].total || 0,
      pending: messageStats[0].pending || 0,
      sent: messageStats[0].sent || 0,
      failed: messageStats[0].failed || 0,
      cancelled: messageStats[0].cancelled || 0,
      total_individual_sends: sendStats[0].total_sends || 0,
      pending_sends: sendStats[0].pending_sends || 0,
      processing_sends: sendStats[0].processing_sends || 0,
      sent_sends: sendStats[0].sent_sends || 0,
      failed_sends: sendStats[0].failed_sends || 0
    };
  }
}

export default new ScheduledMessageService();