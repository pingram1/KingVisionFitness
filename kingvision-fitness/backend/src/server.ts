import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { createServer } from 'http';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import workoutRoutes from './routes/workout.routes';
import nutritionRoutes from './routes/nutrition.routes';
import groupRoutes from './routes/group.routes';
import messageRoutes from './routes/message.routes';
import subscriptionRoutes from './routes/subscription.routes';
import scheduleRoutes from './routes/schedule.routes';
import recommendationRoutes from './routes/recommendation.routes';
import billingRoutes from './routes/billing.routes';
import './models/Bubble';
import './models/Group';
import './models/MealPlan';
import './models/Booking';
import './models/Availability';
import { registerCoachInPocketSockets } from './sockets/coachInPocket.stub';

// Load environment variables (after imports; model files only register schemas)
dotenv.config();

// Initialize Express app
const app: Application = express();
const httpServer = createServer(app);

// Initialize Socket.io for real-time features
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
  }
});
registerCoachInPocketSockets(io);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api', limiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/billing', billingRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Welcome route
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to KingVision Fitness API',
    version: '1.0.0',
    documentation: '/api/docs'
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Join user to their personal room
  socket.on('join-user-room', (userId: string) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Join group rooms
  socket.on('join-group', (groupId: string) => {
    socket.join(`group-${groupId}`);
    console.log(`Socket ${socket.id} joined group ${groupId}`);
  });

  // Handle direct messages
  socket.on('send-message', (data: {
    senderId: string;
    receiverId: string;
    message: string;
  }) => {
    io.to(`user-${data.receiverId}`).emit('new-message', {
      senderId: data.senderId,
      message: data.message,
      timestamp: new Date()
    });
  });

  // Handle group messages
  socket.on('group-message', (data: {
    groupId: string;
    senderId: string;
    message: string;
  }) => {
    socket.to(`group-${data.groupId}`).emit('new-group-message', {
      senderId: data.senderId,
      message: data.message,
      timestamp: new Date()
    });
  });

  // Handle video call signaling
  socket.on('call-user', (data: {
    userToCall: string;
    signalData: any;
    from: string;
    name: string;
  }) => {
    io.to(`user-${data.userToCall}`).emit('call-incoming', {
      signal: data.signalData,
      from: data.from,
      name: data.name
    });
  });

  socket.on('answer-call', (data: {
    signal: any;
    to: string;
  }) => {
    io.to(`user-${data.to}`).emit('call-accepted', data.signal);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  res.status(statusCode).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Database connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kingvision-fitness');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 5001; // Changed to 5001 to avoid conflict with macOS AirPlay Receiver

const startServer = async () => {
  await connectDB();
  
  httpServer.listen(PORT, () => {
    console.log(`
    🚀 Server is running!
    🔊 Listening on port ${PORT}
    📱 Environment: ${process.env.NODE_ENV || 'development'}
    🌐 API URL: http://localhost:${PORT}
    💪 KingVision Fitness API Ready!
    `);
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled Promise Rejection:', err);
  httpServer.close(() => process.exit(1));
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    console.log('Process terminated');
  });
});

// Start the server
startServer();

export { app, io };