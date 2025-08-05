import express, { Express, Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import whatsappRoutes from './routes/whatsapp';
import whatsappService from './services/whatsappService';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/whatsapp', whatsappRoutes);

// Serve the main HTML file
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../src/frontend/index.html'));
});

// Initialize WhatsApp service
whatsappService.initialize().catch(console.error);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});