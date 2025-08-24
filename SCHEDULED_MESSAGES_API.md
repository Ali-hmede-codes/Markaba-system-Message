# Scheduled Messages API Documentation

This document describes the scheduled messages system for the WhatsApp Message Send System.

## Overview

The scheduled messages system allows you to schedule text and media messages to be sent at specific times. The system supports:

- Text messages
- Media messages (images, videos, audio, documents)
- Media messages with captions
- CRUD operations for managing scheduled messages

## Database Setup

Run the SQL script to create the required table:

```sql
-- Execute the contents of create_scheduled_messages_table.sql
```

## Configuration

The scheduled messages feature can be controlled via `settings.json`:

```json
{
  "scheduledMessages": true,
  "scheduledMessageSettings": {
    "enabled": true,
    "checkInterval": 60000,
    "maxRetries": 3,
    "retryDelay": 300000
  }
}
```

### Settings Explanation:
- `scheduledMessages`: Master toggle for the feature
- `enabled`: Enable/disable the scheduler service
- `checkInterval`: How often to check for pending messages (milliseconds)
- `maxRetries`: Maximum retry attempts for failed messages
- `retryDelay`: Delay between retry attempts (milliseconds)

## API Endpoints

All endpoints require authentication via the `checkAuth` middleware.

### 1. Get All Scheduled Messages

**GET** `/api/scheduled-messages`

Query Parameters:
- `status` (optional): Filter by status (`pending`, `sent`, `failed`, `cancelled`)
- `recipient_phone` (optional): Filter by recipient phone number
- `date_from` (optional): Filter messages scheduled from this date (ISO string)
- `date_to` (optional): Filter messages scheduled until this date (ISO string)
- `limit` (optional): Limit number of results
- `offset` (optional): Offset for pagination

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "message_text": "Hello World",
      "media_path": null,
      "media_type": null,
      "caption": null,
      "recipient_phone": "+1234567890",
      "scheduled_time": "2024-01-15T10:30:00.000Z",
      "status": "pending",
      "created_at": "2024-01-14T08:00:00.000Z",
      "updated_at": "2024-01-14T08:00:00.000Z",
      "sent_at": null,
      "error_message": null,
      "retry_count": 0,
      "max_retries": 3,
      "created_by": 1
    }
  ],
  "count": 1
}
```

### 2. Get Scheduled Message by ID

**GET** `/api/scheduled-messages/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "message_text": "Hello World",
    "recipient_phone": "+1234567890",
    "scheduled_time": "2024-01-15T10:30:00.000Z",
    "status": "pending"
  }
}
```

### 3. Create Scheduled Message

**POST** `/api/scheduled-messages`

**Content-Type:** `multipart/form-data` (for media uploads) or `application/json` (for text only)

**Body Parameters:**
- `message_text` (optional): Text message content
- `recipient_phone` (required): Recipient phone number
- `scheduled_time` (required): When to send the message (ISO string, must be in future)
- `caption` (optional): Caption for media messages
- `media_type` (optional): Type of media (`image`, `video`, `audio`, `document`)
- `media` (optional): Media file (multipart upload)

**Examples:**

1. Text Message:
```json
{
  "message_text": "Hello, this is a scheduled message!",
  "recipient_phone": "+1234567890",
  "scheduled_time": "2024-01-15T10:30:00.000Z"
}
```

2. Media with Caption:
```javascript
// FormData for file upload
const formData = new FormData();
formData.append('media', fileInput.files[0]);
formData.append('caption', 'Check out this image!');
formData.append('recipient_phone', '+1234567890');
formData.append('scheduled_time', '2024-01-15T10:30:00.000Z');
formData.append('media_type', 'image');
```

**Response:**
```json
{
  "success": true,
  "message": "Scheduled message created successfully",
  "data": {
    "id": 1,
    "message_text": "Hello, this is a scheduled message!",
    "recipient_phone": "+1234567890",
    "scheduled_time": "2024-01-15T10:30:00.000Z",
    "status": "pending"
  }
}
```

### 4. Update Scheduled Message

**PUT** `/api/scheduled-messages/:id`

**Content-Type:** `multipart/form-data` or `application/json`

**Body Parameters:** Same as create, all optional

**Response:**
```json
{
  "success": true,
  "message": "Scheduled message updated successfully",
  "data": {
    "id": 1,
    "message_text": "Updated message text",
    "recipient_phone": "+1234567890",
    "scheduled_time": "2024-01-15T11:00:00.000Z",
    "status": "pending"
  }
}
```

### 5. Delete Scheduled Message

**DELETE** `/api/scheduled-messages/:id`

**Response:**
```json
{
  "success": true,
  "message": "Scheduled message deleted successfully"
}
```

### 6. Cancel Scheduled Message

**POST** `/api/scheduled-messages/:id/cancel`

**Response:**
```json
{
  "success": true,
  "message": "Scheduled message cancelled successfully",
  "data": {
    "id": 1,
    "status": "cancelled"
  }
}
```

### 7. Get Statistics

**GET** `/api/scheduled-messages/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 100,
    "pending": 25,
    "sent": 60,
    "failed": 10,
    "cancelled": 5
  }
}
```

## Message Types

### 1. Text Only
- Provide only `message_text`
- No media file required

### 2. Media Only
- Provide only media file
- Specify `media_type` if needed (auto-detected from file)

### 3. Media with Caption
- Provide both media file and `caption`
- The caption will be sent with the media

## File Upload

- Maximum file size: 50MB
- Supported formats: JPEG, PNG, GIF, MP4, AVI, MOV, MP3, WAV, PDF, DOC, DOCX
- Files are stored in `uploads/scheduled-messages/` directory
- Files are automatically deleted when the scheduled message is deleted

## Error Handling

Common error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

**HTTP Status Codes:**
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `404`: Not Found
- `500`: Internal Server Error

## Scheduler Service

The scheduler service runs in the background and:

1. Checks for pending messages every `checkInterval` milliseconds
2. Sends messages that are due
3. Handles retry logic for failed messages
4. Updates message status accordingly

### Message Status Flow

1. `pending` → `sent` (successful delivery)
2. `pending` → `pending` (failed, but retries remaining)
3. `pending` → `failed` (failed, max retries reached)
4. `pending` → `cancelled` (manually cancelled)

## Integration with WhatsApp Service

The scheduler integrates with the existing WhatsApp service methods:

- `whatsappService.sendMessage()` - for text messages
- `whatsappService.sendImage()` - for image files
- `whatsappService.sendVideo()` - for video files
- `whatsappService.sendAudio()` - for audio files
- `whatsappService.sendDocument()` - for document files

## Security Considerations

- All endpoints require authentication
- File uploads are validated for type and size
- Scheduled times must be in the future
- Media files are stored securely and cleaned up when deleted
- SQL injection protection via parameterized queries

## Monitoring

The system logs:
- Scheduler start/stop events
- Message processing attempts
- Success/failure notifications
- Database connection issues

Check the console output for real-time monitoring of the scheduled message system.