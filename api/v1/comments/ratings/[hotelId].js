import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { connectToDatabase } from '../../../../src/lib/mongodb.js';
import { getRedisClient } from '../../../../src/lib/redis.js';

dotenv.config({ path: '.env.local' });

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { hotelId } = req.query;
  const cacheKey = `ratings:${hotelId}`;
  const redis = getRedisClient();

  try {
    const cachedResult = await redis.get(cacheKey);
    if (cachedResult) return res.status(200).json(JSON.parse(cachedResult));
  } catch(e) {}

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

    try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 900); // 15 mins TTL
    } catch(e) {}

    return res.status(200).json(result);
  } catch (error) {
    console.error('Ratings aggregation error:', error);
    return res.status(500).json({ error: error.message });
  }
}
