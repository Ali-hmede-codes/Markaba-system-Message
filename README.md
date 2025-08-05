# WhatsApp Message Send System

A full-stack web application for sending messages and media files to multiple WhatsApp groups simultaneously.

## Features

- **Multi-Group Messaging**: Send messages to multiple WhatsApp groups at once
- **Media Support**: Send images, videos, documents, and other media files
- **Batch Processing**: Configure batch size for controlled message sending
- **Real-time Status**: Live connection status and message sending progress
- **Group Management**: View and select from available WhatsApp groups
- **Authentication**: Secure WhatsApp Web authentication via QR code

## Tech Stack

### Backend
- **Node.js** with Express.js
- **TypeScript** for type safety
- **whatsapp-web.js** for WhatsApp integration
- **Multer** for file upload handling

### Frontend
- **HTML5** with modern CSS3
- **Vanilla JavaScript** with TypeScript
- **Responsive Design** for mobile and desktop

### Database
- **JSON-based** group caching
- **File system** for session management

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd WhatsappMessageSendSystem
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

## Usage

1. **Authentication**
   - Open the application in your browser
   - Scan the QR code with your WhatsApp mobile app
   - Wait for successful connection

2. **Load Groups**
   - Click "Load Groups" to fetch your WhatsApp groups
   - Select the groups you want to send messages to

3. **Send Messages**
   - Type your message in the text area
   - Optionally attach media files
   - Configure batch size (default: 5)
   - Click "Send Message" to start sending

## Project Structure

```
WhatsappMessageSendSystem/
├── src/
│   ├── backend/
│   │   ├── routes/
│   │   │   └── whatsapp.ts          # WhatsApp API routes
│   │   ├── services/
│   │   │   └── whatsappService.ts   # WhatsApp service logic
│   │   ├── server.js                # Express server (JS)
│   │   └── server.ts                # Express server (TS)
│   └── frontend/
│       ├── css/
│       │   └── styles.css           # Application styles
│       ├── js/
│       │   └── app.js               # Frontend JavaScript
│       └── index.html               # Main HTML file
├── .gitignore                       # Git ignore rules
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
└── README.md                        # Project documentation
```

## API Endpoints

- `GET /api/whatsapp/status` - Get WhatsApp connection status
- `GET /api/whatsapp/groups` - Fetch available groups
- `POST /api/whatsapp/send` - Send message to selected groups
- `POST /api/whatsapp/logout` - Logout from WhatsApp
- `POST /api/whatsapp/reconnect` - Force reconnection

## Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development
```

### Batch Size
Adjust the batch size in the frontend to control how many groups receive messages simultaneously. Lower values reduce the risk of being rate-limited.

## Security Features

- **Input Validation**: All user inputs are validated and sanitized
- **File Type Restrictions**: Only allowed file types can be uploaded
- **Rate Limiting**: Batch processing prevents spam
- **Session Management**: Secure WhatsApp session handling

## Troubleshooting

### Common Issues

1. **"No groups selected" error**
   - Ensure you've loaded groups first
   - Check that at least one group is selected

2. **Connection issues**
   - Try the "Force Reconnect" button
   - Clear browser cache and restart
   - Check your internet connection

3. **QR code not appearing**
   - Refresh the page
   - Check browser console for errors

## Development

### Scripts
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm run build` - Build TypeScript files

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for educational and personal use. Please ensure compliance with WhatsApp's Terms of Service when using this application.

## Disclaimer

This application uses unofficial WhatsApp Web API. Use at your own risk and ensure compliance with WhatsApp's terms of service. The developers are not responsible for any account restrictions or bans.

## Support

For issues and questions, please create an issue in the GitHub repository.