// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

import express, { Express, Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import whatsappRoutes from './routes/whatsapp';
import telegramRoutes from './routes/telegram';
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';
import scheduledMessagesRoutes from './routes/scheduledMessages';
import notificationsRoutes from './routes/notifications';
import whatsappService from './services/whatsappService';
import telegramService from './services/telegramService';
import databaseService from './services/databaseService';
import authService from './services/authService';
import schedulingService from './services/schedulingService';
import { checkAuth, optionalAuth } from './middleware/auth';

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

// Security headers to prevent search engine indexing
app.use((req: Request, res: Response, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noimageindex');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Health check endpoint
app.get('/api/health', async (req: Request, res: Response) => {
  let dbStatus = 'unknown';
  try {
    await databaseService.testConnection();
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'disconnected';
    console.error('Database health check failed:', error);
  }
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
    database: dbStatus
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/scheduled-messages', checkAuth, scheduledMessagesRoutes);
app.use('/api/notifications', checkAuth, notificationsRoutes);

// Serve login page
app.get('/login', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../src/frontend/login.html'));
});

// Serve admin panel (admin only)
app.get('/admin', checkAuth, (req: Request, res: Response) => {
  // Check if user is admin
  if ((req as any).user.role !== 'admin') {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, '../../src/frontend/admin.html'));
});

// Main route - redirect to login page
app.get('/', (req: Request, res: Response) => {
  res.redirect('/login');
});

// Dashboard route - serves main app after authentication
app.get('/dashboard', checkAuth, (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../src/frontend/index.html'));
});

// Serve robots.txt specifically
app.get('/robots.txt', (req: Request, res: Response) => {
  res.type('text/plain');
  res.sendFile(path.join(__dirname, '../../src/frontend/robots.txt'));
});

// Serve static files after routes to prevent conflicts
app.use(express.static(path.join(__dirname, '../../src/frontend')));

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
  // Initialize database connection (optional)
  try {
    await databaseService.initialize();
    await databaseService.testConnection();
    console.log('Database connected successfully');
  } catch (dbError) {
    console.warn('Database connection failed (continuing without database):', dbError instanceof Error ? dbError.message : 'Unknown error');
  }
  
  // Initialize WhatsApp and Telegram services
  try {
    await whatsappService.initialize();
    console.log('WhatsApp service initialized');
  } catch (whatsappError) {
    console.warn('WhatsApp initialization failed:', whatsappError instanceof Error ? whatsappError.message : 'Unknown error');
  }
  
  try {
    await telegramService.initialize();
    console.log('Telegram service initialized successfully');
  } catch (telegramError) {
    console.error('Telegram initialization failed:', telegramError instanceof Error ? telegramError.message : 'Unknown error');
  }
  
  // Initialize scheduling service
  try {
    schedulingService.initialize();
    console.log('Scheduling service initialized successfully');
  } catch (schedulingError) {
    console.error('Scheduling service initialization failed:', schedulingError instanceof Error ? schedulingError.message : 'Unknown error');
  }
  
  console.log('Service initialization completed');
}

initializeServices();

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});