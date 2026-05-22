import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
import { getRedisClient } from '../../../src/lib/redis.js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  const token = req.headers.authorization;
  
  let isAuthenticated = false;
  if (token) {
      const { data: { user } } = await supabase.auth.getUser(token.replace('Bearer ', ''));
      if (user) isAuthenticated = true;
  }

  const cacheKey = `hotel:${id}`;
  const redis = getRedisClient();

  try {
    const cachedResult = await redis.get(cacheKey);
    if (cachedResult) {
      const parsedData = JSON.parse(cachedResult);
      if (isAuthenticated) {
          parsedData.room_types.forEach(rt => {
              rt.discounted = true;
              rt.price_per_night = (rt.price_per_night * 0.85).toFixed(2);
          });
      }
      return res.status(200).json(parsedData);
    }
  } catch(e) { console.error('Redis Error', e); }

  try {
    const { data: hotel, error } = await supabase
      .from('hotels')
      .select(`
        *,
        room_types (
          id, name, capacity, price_per_night, total_rooms
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

    try {
        await redis.set(cacheKey, JSON.stringify(hotel), 'EX', 600); // 10 mins TTL
    } catch(e) {}

    if (isAuthenticated) {
        hotel.room_types.forEach(rt => {
            rt.discounted = true;
            rt.price_per_night = (rt.price_per_night * 0.85).toFixed(2);
        });
    }

    return res.status(200).json(hotel);
  } catch (error) {
    console.error('Hotel detail error:', error);
    return res.status(500).json({ error: error.message });
  }
}
