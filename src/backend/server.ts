import express, { Express, Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import whatsappRoutes from './routes/whatsapp';
import telegramRoutes from './routes/telegram';
import authRoutes from './routes/auth';
import whatsappService from './services/whatsappService';
import telegramService from './services/telegramService';
import databaseService from './services/databaseService';
import { checkAuth, optionalAuth } from './middleware/auth';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname, '../../src/frontend')));

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/telegram', telegramRoutes);

// Serve login page
app.get('/login', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../src/frontend/login.html'));
});

// Serve the main HTML file
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../src/frontend/index.html'));
});

// Catch all other routes
// app.get('*', (req: Request, res: Response) => {
//   res.redirect('/');
// });

// Simple 404 handler instead
app.use((req: Request, res: Response) => {
  res.status(404).send('Page not found');
});

// Initialize services
async function initializeServices() {
  try {
    // Initialize database connection
    await databaseService.initialize();
    await databaseService.testConnection();
    console.log('Database connected successfully');
    
    // Initialize WhatsApp and Telegram services
    await whatsappService.initialize();
    await telegramService.initialize();
    
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Service initialization error:', error);
    process.exit(1);
  }
}

initializeServices();

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});