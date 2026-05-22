import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getRedisClient, clearSearchCaches } from '../../../src/lib/redis.js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user } } = await supabase.auth.getUser(token.replace('Bearer ', ''));
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  // Verify Admin Role
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admin only.' });

  if (req.method === 'POST') {
    const { hotelId, name, capacity, pricePerNight, totalRooms } = req.body;
    
    // Check if admin owns this hotel
    const { data: hotel } = await supabase.from('hotels').select('admin_id').eq('id', hotelId).single();
    if (hotel?.admin_id !== user.id) return res.status(403).json({ error: 'You do not own this hotel.' });

    const { data, error } = await supabase.from('room_types').insert([{
        hotel_id: hotelId,
        name,
        capacity: parseInt(capacity),
        price_per_night: parseFloat(pricePerNight),
        total_rooms: parseInt(totalRooms)
    }]);

    if (error) return res.status(400).json({ error: error.message });

    // Invalidate Cache
    try {
      const redis = getRedisClient();
      await redis.del(`hotel:${hotelId}`);
      await clearSearchCaches();
    } catch (e) {}

    return res.status(201).json({ success: true });
    
  } else if (req.method === 'PUT') {
      const { id, name, capacity, pricePerNight, totalRooms } = req.body;

      // Fetch hotel_id first to invalidate cache
      const { data: rt } = await supabase.from('room_types').select('hotel_id').eq('id', id).single();
      const hotelId = rt?.hotel_id;

      const { data, error } = await supabase.from('room_types').update({
          name, capacity, price_per_night: pricePerNight, total_rooms: totalRooms
      }).eq('id', id);

      if (error) return res.status(400).json({ error: error.message });

      // Invalidate Cache
      if (hotelId) {
        try {
          const redis = getRedisClient();
          await redis.del(`hotel:${hotelId}`);
          await clearSearchCaches();
        } catch (e) {}
      }

      return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
