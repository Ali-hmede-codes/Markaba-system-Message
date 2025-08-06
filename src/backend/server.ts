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
import whatsappService from './services/whatsappService';
import telegramService from './services/telegramService';
import databaseService from './services/databaseService';
import authService from './services/authService';
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

// Serve admin panel (admin only)
app.get('/admin', checkAuth, (req: Request, res: Response) => {
  // Check if user is admin
  if ((req as any).user.role !== 'admin') {
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, '../../src/frontend/admin.html'));
});

// Serve the main HTML file - redirect to login if not authenticated
app.get('/', async (req: Request, res: Response) => {
  try {
    const sessionId = req.cookies.session_id;
    
    if (!sessionId) {
      return res.redirect('/login');
    }
    
    // Validate the session
    const user = await authService.validateSession(sessionId);
    
    if (!user) {
      // Clear invalid session cookie and redirect to login
      res.clearCookie('session_id');
      return res.redirect('/login');
    }
    
    // Valid session, serve the main page
    res.sendFile(path.join(__dirname, '../../src/frontend/index.html'));
  } catch (error) {
    console.error('Main route auth error:', error);
    res.clearCookie('session_id');
    res.redirect('/login');
  }
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
  
  console.log('Service initialization completed');
}

initializeServices();

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});