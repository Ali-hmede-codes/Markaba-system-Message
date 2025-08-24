-- Create scheduled_messages table for WhatsApp Message Send System
-- This table stores scheduled messages with support for text and media

CREATE TABLE IF NOT EXISTS `scheduled_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `message_text` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `media_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `media_type` enum('image','video','audio','document') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `caption` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient_phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `expire_date` date NOT NULL,
  `send_times` json NOT NULL COMMENT 'Array of time strings like ["10:10", "19:30"]',
  `status` enum('pending','sent','failed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `sent_at` timestamp NULL DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_start_date` (`start_date`),
  KEY `idx_end_date` (`end_date`),
  KEY `idx_expire_date` (`expire_date`),
  KEY `idx_status` (`status`),
  KEY `idx_recipient_phone` (`recipient_phone`),
  KEY `idx_created_by` (`created_by`),
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create a separate table to track individual message sends
CREATE TABLE IF NOT EXISTS `scheduled_message_sends` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `scheduled_message_id` int(11) NOT NULL,
  `send_date` date NOT NULL,
  `send_time` time NOT NULL,
  `status` enum('pending','processing','sent','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `sent_at` timestamp NULL DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_send_datetime` (`send_date`, `send_time`),
  KEY `idx_status` (`status`),
  KEY `idx_scheduled_message_id` (`scheduled_message_id`),
  UNIQUE KEY `unique_message_send` (`scheduled_message_id`, `send_date`, `send_time`),
  FOREIGN KEY (`scheduled_message_id`) REFERENCES `scheduled_messages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add indexes for better performance
CREATE INDEX `idx_scheduled_pending` ON `scheduled_messages` (`scheduled_time`, `status`);
CREATE INDEX `idx_created_at` ON `scheduled_messages` (`created_at`);