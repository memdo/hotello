import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ==========================================
// VALIDATION HELPERS
// ==========================================
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECTID_REGEX = /^[0-9a-f]{24}$/i;

function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

function isValidObjectId(str) {
  return typeof str === 'string' && OBJECTID_REGEX.test(str);
}

function isIntInRange(val, min, max) {
  const n = parseInt(val, 10);
  return !isNaN(n) && n >= min && n <= max;
}

function clampInt(val, min, max, defaultVal) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return defaultVal;
  return Math.max(min, Math.min(max, n));
}

// 1. Supabase Client Setup
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// 2. MongoDB Setup
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Please add your MONGODB_URI to environment variables');
  }

  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db();

  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

// 3. Redis Setup
let redisClient = null;
function getRedisClient() {
  if (!redisClient && process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL, {
      tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
    });
    redisClient.on('error', (err) => {
      console.error('Redis error:', err);
    });
  }
  return redisClient;
}

// Helper to authenticate request using token
async function authenticateToken(req) {
  const token = req.headers.authorization;
  if (!token) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser(token.replace('Bearer ', ''));
    return user || null;
  } catch (e) {
    return null;
  }
}

// ==========================================
// REST ROUTES
// ==========================================

// GET /api/v1/comments/me
app.get('/api/v1/comments/me', async (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const user = await authenticateToken(req);
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  try {
    const { db } = await connectToDatabase();

    const comments = await db.collection('comments')
      .find({ user_id: user.id })
      .sort({ created_at: -1 })
      .toArray();

    return res.status(200).json(comments);
  } catch (error) {
    console.error('Fetch user comments error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/comments/:hotelId
app.get('/api/v1/comments/:hotelId', async (req, res) => {
  const { hotelId } = req.params;
  const { page: rawPage, limit: rawLimit } = req.query;
  const page = clampInt(rawPage, 1, 1000, 1);
  const limit = clampInt(rawLimit, 1, 50, 10);

  try {
    const { db } = await connectToDatabase();
    const skip = (page - 1) * limit;

    const count = await db.collection('comments').countDocuments({ hotel_id: hotelId });
    const comments = await db.collection('comments')
      .find({ hotel_id: hotelId })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return res.status(200).json({
      comments,
      pagination: { page, limit, total: count }
    });
  } catch (error) {
    console.error('Fetch comments error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/comments/ratings/:hotelId
app.get('/api/v1/comments/ratings/:hotelId', async (req, res) => {
  const { hotelId } = req.params;
  const cacheKey = `ratings:${hotelId}`;
  const redis = getRedisClient();

  if (redis) {
    try {
      const cachedResult = await redis.get(cacheKey);
      if (cachedResult) return res.status(200).json(JSON.parse(cachedResult));
    } catch (e) {
      console.error('Redis read error:', e);
    }
  }

  try {
    const { db } = await connectToDatabase();
    const comments = await db.collection('comments')
      .find({ hotel_id: hotelId })
      .project({
        rating_overall: 1,
        rating_cleanliness: 1,
        rating_staff: 1,
        rating_facilities: 1,
        rating_location: 1,
        rating_comfort: 1
      })
      .toArray();

    if (!comments || comments.length === 0) {
      return res.status(200).json({ overall: 0, count: 0, categories: {} });
    }

    const count = comments.length;
    const sum = (field) => comments.reduce((acc, c) => acc + (c[field] || 0), 0);

    const result = {
      overall: (sum('rating_overall') / count).toFixed(1),
      count,
      categories: {
        cleanliness: (sum('rating_cleanliness') / count).toFixed(1),
        staff: (sum('rating_staff') / count).toFixed(1),
        facilities: (sum('rating_facilities') / count).toFixed(1),
        location: (sum('rating_location') / count).toFixed(1),
        comfort: (sum('rating_comfort') / count).toFixed(1),
      }
    };

    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 900); // 15 mins TTL
      } catch (e) {
        console.error('Redis write error:', e);
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Ratings aggregation error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/comments/:hotelId
app.post('/api/v1/comments/:hotelId', async (req, res) => {
  const { hotelId } = req.params;
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const user = await authenticateToken(req);
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  const {
    ratingOverall, ratingCleanliness, ratingStaff,
    ratingFacilities, ratingLocation, ratingComfort, commentText
  } = req.body;

  // Validate ratings
  const ratingFields = { ratingOverall, ratingCleanliness, ratingStaff, ratingFacilities, ratingLocation, ratingComfort };
  for (const [field, value] of Object.entries(ratingFields)) {
    if (!isIntInRange(value, 1, 10)) {
      return res.status(400).json({ error: `${field} must be an integer between 1 and 10.` });
    }
  }

  // Validate comment text
  if (!commentText || typeof commentText !== 'string' || commentText.trim().length === 0) {
    return res.status(400).json({ error: 'commentText is required and cannot be empty.' });
  }
  if (commentText.length > 5000) {
    return res.status(400).json({ error: 'commentText cannot exceed 5000 characters.' });
  }

  try {
    // Fetch full_name from Supabase user_profiles
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const { db } = await connectToDatabase();

    const commentDoc = {
      hotel_id: hotelId,
      user_id: user.id,
      rating_overall: parseInt(ratingOverall, 10),
      rating_cleanliness: parseInt(ratingCleanliness, 10),
      rating_staff: parseInt(ratingStaff, 10),
      rating_facilities: parseInt(ratingFacilities, 10),
      rating_location: parseInt(ratingLocation, 10),
      rating_comfort: parseInt(ratingComfort, 10),
      comment_text: commentText.trim(),
      user_profiles: {
        full_name: profile?.full_name || 'Anonymous User'
      },
      created_at: new Date()
    };

    await db.collection('comments').insertOne(commentDoc);

    // Invalidate ratings cache in Redis
    const redis = getRedisClient();
    if (redis) {
      try {
        await redis.del(`ratings:${hotelId}`);
      } catch (redisErr) {
        console.error('Redis delete error:', redisErr);
      }
    }

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('Insert comment error:', error);
    return res.status(400).json({ error: error.message });
  }
});

// DELETE /api/v1/comments/:id
app.delete('/api/v1/comments/:id', async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid comment ID format.' });
  }

  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const user = await authenticateToken(req);
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  try {
    const { db } = await connectToDatabase();

    const comment = await db.collection('comments').findOne({ _id: new ObjectId(id) });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.user_id !== user.id) return res.status(403).json({ error: 'Forbidden' });

    await db.collection('comments').deleteOne({ _id: new ObjectId(id) });

    const redis = getRedisClient();
    if (redis && comment.hotel_id) {
      try {
        await redis.del(`ratings:${comment.hotel_id}`);
      } catch (redisErr) {
        console.error('Redis delete error:', redisErr);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Comments Service running on port ${PORT}`);
});
