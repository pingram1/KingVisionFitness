// Env validation runs at the very first import — if MONGODB_URI / JWT_SECRET /
// JWT_REFRESH_SECRET are missing or use the legacy placeholders, the process
// exits before any route is mounted.
import { env } from './config/env';

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { createServer } from 'http';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

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
import adminRoutes from './routes/admin.routes';
import gamificationRoutes from './routes/gamification.routes';
import stripeWebhookRoutes from './routes/stripeWebhook.routes';
import './models/Bubble';
import './models/Group';
import './models/MealPlan';
import './models/Booking';
import './models/Availability';
import './models/StripeWebhookEvent';
import { registerCoachInPocketSockets } from './sockets/coachInPocket.stub';
import { attachSocketAuth, registerAuthedRoomHandlers } from './sockets/auth';

const app: Application = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.CLIENT_URL,
    credentials: true,
  },
});

// Reject unauthenticated socket handshakes BEFORE any handlers register. After
// this point, every connected socket has a verified `data.userId`.
attachSocketAuth(io);
if (env.ENABLE_COACH_IN_POCKET_SOCKETS || env.NODE_ENV !== 'production') {
  registerCoachInPocketSockets(io);
}

// ── Security headers / CORS / compression / logging ────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);
app.use(compression());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Stripe webhook (RAW body) — MUST be mounted BEFORE express.json() ──────────
// Signature verification reads the original bytes of the payload. If JSON
// parsing happens first, `req.body` becomes a parsed object and Stripe's
// constructEvent always rejects the signature.
app.use('/api/webhooks', stripeWebhookRoutes);

// ── JSON / form parsers for the rest of the API ───────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Strip MongoDB operators (`$gt`, `$ne`, ...) from req.body / query / params
// so an unvalidated handler can't be coerced into a query injection.
app.use(mongoSanitize());

// Collapse duplicate query/body keys, e.g. `?role=CLIENT&role=SUPER_ADMIN`,
// to the last value — prevents parameter pollution against array-aware logic.
app.use(hpp());

// ── Rate limiting ──────────────────────────────────────────────────────────────
// Stripe retries failed webhook deliveries aggressively; the global limiter
// would 429 them and lose state-machine events. Skip `/api/webhooks/*` — those
// requests are already gated by signature verification.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 100 : 500,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => req.originalUrl.startsWith('/api/webhooks/'),
});
app.use('/api', limiter);

// ── API Routes ─────────────────────────────────────────────────────────────────
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
app.use('/api/admin', adminRoutes);
app.use('/api/gamification', gamificationRoutes);

// ── Health check ───────────────────────────────────────────────────────────────
const healthHandler = (_req: Request, res: Response) => {
  const mongoReady = mongoose.connection.readyState === 1;
  res.status(mongoReady ? 200 : 503).json({
    status: mongoReady ? 'ok' : 'degraded',
    mongo: mongoReady ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to KingVision Fitness API',
    version: '1.0.0',
    documentation: '/api/docs',
  });
});

// ── Socket.io ──────────────────────────────────────────────────────────────────
// All socket handlers below use the authed wrapper. The user-room is joined
// automatically; group rooms require server-side membership verification.
registerAuthedRoomHandlers(io);

io.on('connection', (socket) => {
  const userId = (socket.data as { userId?: string }).userId;
  if (env.NODE_ENV !== 'production') {
    console.log('[socket] connected', socket.id, 'as user', userId);
  }

  socket.on(
    'send-message',
    (data: { receiverId: string; message: string }) => {
      if (!userId || typeof data?.receiverId !== 'string' || typeof data?.message !== 'string') return;
      io.to(`user-${data.receiverId}`).emit('new-message', {
        senderId: userId,
        message: data.message,
        timestamp: new Date(),
      });
    }
  );

  socket.on(
    'group-message',
    (data: { groupId: string; message: string }) => {
      if (!userId || typeof data?.groupId !== 'string' || typeof data?.message !== 'string') return;
      // Only emit if the socket actually joined this group room — which the
      // authed `join-group` handler enforces via Group.isMember.
      if (!socket.rooms.has(`group-${data.groupId}`)) return;
      socket.to(`group-${data.groupId}`).emit('new-group-message', {
        senderId: userId,
        message: data.message,
        timestamp: new Date(),
      });
    }
  );

  socket.on(
    'call-user',
    (data: { userToCall: string; signalData: unknown; name: string }) => {
      if (!userId || typeof data?.userToCall !== 'string') return;
      io.to(`user-${data.userToCall}`).emit('call-incoming', {
        signal: data.signalData,
        from: userId,
        name: data.name,
      });
    }
  );

  socket.on('answer-call', (data: { signal: unknown; to: string }) => {
    if (!userId || typeof data?.to !== 'string') return;
    io.to(`user-${data.to}`).emit('call-accepted', data.signal);
  });

  socket.on('disconnect', () => {
    if (env.NODE_ENV !== 'production') {
      console.log('[socket] disconnected', socket.id);
    }
  });
});

// ── Error handling ─────────────────────────────────────────────────────────────
// Production responses NEVER leak internal error messages or stack traces.
// Use a stable shape and let logs carry the diagnostic detail.
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', req.method, req.originalUrl, err.stack || err.message);

  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  if (env.NODE_ENV === 'production') {
    res.status(statusCode).json({ success: false, message: 'Server error' });
    return;
  }

  res.status(statusCode).json({
    success: false,
    message: err.message,
    stack: err.stack,
  });
});

app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// ── Database connection ────────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      // Conservative defaults — tune in PR for S17 once we have prod traffic
      // numbers. These keep idle connections low and fail fast on outage.
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 10_000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

const startServer = async () => {
  await connectDB();
  httpServer.listen(env.PORT, () => {
    console.log(`
    🚀 Server is running!
    🔊 Listening on port ${env.PORT}
    📱 Environment: ${env.NODE_ENV}
    🌐 API URL: http://localhost:${env.PORT}
    💪 KingVision Fitness API Ready!
    `);
  });
};

// ── Graceful shutdown ──────────────────────────────────────────────────────────
let shuttingDown = false;
const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    console.error('Forced exit after 15s shutdown timeout');
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  io.close();
  httpServer.close(async () => {
    try {
      await mongoose.connection.close();
      console.log('Process terminated cleanly');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
};

process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled Promise Rejection:', err);
  shutdown('unhandledRejection');
});
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();

export { app, io };
