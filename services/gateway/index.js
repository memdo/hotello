import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { rateLimit } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());


// 1. Redis Setup
let redisClient = null;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
  });
  redisClient.on('error', (err) => console.error('Redis error:', err));
}

// 2. Supabase Setup
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// 3. Auth & Rate Limiting Middleware
app.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const cacheKey = `token:${token}`;

    try {
      if (redisClient) {
        const cachedUserId = await redisClient.get(cacheKey);
        if (cachedUserId) {
          req.user = { id: cachedUserId };
          return next();
        }
      }

      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (user) {
        req.user = user;
        if (redisClient) {
          await redisClient.set(cacheKey, user.id, 'EX', 300); // Cache for 5 mins
        }
      }
    } catch (e) {
      console.error('Token validation error:', e.message);
    }
  }
  next();
});

if (redisClient) {
  // Hourly Rate Limiter
  const hourlyLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: (req, res) => req.user ? 5000 : 1000,
    skip: (req) => req.path === '/api/v1/hotels/locations',
    keyGenerator: (req) => req.user ? `rl:hourly:user:${req.user.id}` : `rl:hourly:ip:${req.socket.remoteAddress}`,
    validate: false,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
    }),
    message: { error: 'Too many requests this hour, please try again later.' }
  });

  // Daily Rate Limiter
  const dailyLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    limit: (req, res) => req.user ? 20000 : 5000,
    skip: (req) => req.path === '/api/v1/hotels/locations',
    keyGenerator: (req) => req.user ? `rl:daily:user:${req.user.id}` : `rl:daily:ip:${req.socket.remoteAddress}`,
    validate: false,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
    }),
    message: { error: 'Too many requests today, please try again tomorrow.' }
  });

  app.use(hourlyLimiter);
  app.use(dailyLimiter);
} else {
  // Fallback in-memory rate limiter when Redis is unavailable
  console.warn('[GATEWAY] Redis not available. Using in-memory rate limiting as fallback.');
  const fallbackLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
  });
  app.use(fallbackLimiter);
}

// Default fallback target URLs (with local defaults if unset)
const HOTEL_SERVICE_URL = process.env.HOTEL_SERVICE_URL || 'http://localhost:3001';
const COMMENTS_SERVICE_URL = process.env.COMMENTS_SERVICE_URL || 'http://localhost:3002';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3003';
const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3004';

// Route: Hotels & Search
app.use(createProxyMiddleware({
  pathFilter: '/api/v1/hotels',
  target: HOTEL_SERVICE_URL,
  changeOrigin: true
}));

// Route: Comments & Ratings
app.use(createProxyMiddleware({
  pathFilter: '/api/v1/comments',
  target: COMMENTS_SERVICE_URL,
  changeOrigin: true
}));

// Route: Notifications & Workers
app.use(createProxyMiddleware({
  pathFilter: '/api/v1/notifications',
  target: NOTIFICATION_SERVICE_URL,
  changeOrigin: true
}));

// Route: Agent
app.use(createProxyMiddleware({
  pathFilter: '/api/v1/agent',
  target: AGENT_SERVICE_URL,
  changeOrigin: true
}));

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
