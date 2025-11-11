import express, { Application, Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { initializeSocketServer } from './lib/socket';
import { errorHandler, notFoundHandler } from './middleware/error';
import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat.routes';

// Load environment variables
dotenv.config();

// Initialize Express app
const app: Application = express();
const httpServer = createServer(app);

// Configuration
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN?.split(',') || '*';

// Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req: Request, res: Response, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Initialize Socket.IO
const io = initializeSocketServer(httpServer);

// Store io instance in app for use in routes if needed
app.set('io', io);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
httpServer.listen(PORT, () => {
  console.log(`=€ Server running on port ${PORT}`);
  console.log(`=á Socket.IO server initialized`);
  console.log(`< Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`= CORS enabled for: ${CORS_ORIGIN}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default app;
