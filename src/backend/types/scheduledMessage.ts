export interface ScheduledMessage {
  id: number;
  message_text?: string;
  media_path?: string;
  media_type?: 'image' | 'video' | 'audio' | 'document';
  caption?: string;
  recipient_phone: string;
  start_date: string;
  end_date: string;
  expire_date: string;
  send_times: string[]; // Array of time strings like ["10:10", "19:30"]
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  created_at: string;
  updated_at: string;
  sent_at?: string;
  error_message?: string;
  user_id?: number;
}

export interface ScheduledMessageSend {
  id: number;
  scheduled_message_id: number;
  send_date: string;
  send_time: string;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  sent_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduledMessageRequest {
  message_text?: string;
  media_path?: string;
  media_type?: 'image' | 'video' | 'audio' | 'document';
  caption?: string;
  recipient_phone: string;
  start_date: string;
  end_date: string;
  expire_date: string;
  send_times: string[]; // Array of time strings like ["10:10", "19:30"]
}

export interface UpdateScheduledMessageRequest {
  message_text?: string;
  media_path?: string;
  media_type?: 'image' | 'video' | 'audio' | 'document';
  caption?: string;
  recipient_phone?: string;
  start_date?: string;
  end_date?: string;
  expire_date?: string;
  send_times?: string[];
  status?: 'pending' | 'sent' | 'failed' | 'cancelled';
}

export interface ScheduledMessageFilter {
  status?: 'pending' | 'sent' | 'failed' | 'cancelled';
  recipient_phone?: string;
  start_date_from?: string;
  start_date_to?: string;
  end_date_from?: string;
  end_date_to?: string;
  limit?: number;
  offset?: number;
}

export interface ScheduledMessageStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  cancelled: number;
  total_individual_sends: number;
  pending_sends: number;
  processing_sends: number;
  sent_sends: number;
  failed_sends: number;
}