import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getRedisClient, clearSearchCaches } from '../../../../src/lib/redis.js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user } } = await supabase.auth.getUser(token.replace('Bearer ', ''));
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  // Verify Admin Role
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admin only.' });

  const { roomTypeId, startDate, endDate, isAvailable, availableCount } = req.body;

  if (!roomTypeId || !startDate || !endDate) {
    return res.status(400).json({ error: 'Missing required parameters: roomTypeId, startDate, endDate' });
  }

  try {
    // Check if admin owns the hotel for this room type
    const { data: roomType, error: rtError } = await supabase
      .from('room_types')
      .select('id, total_rooms, hotel_id, hotels(id, admin_id)')
      .eq('id', roomTypeId)
      .single();

    if (rtError || !roomType) {
      return res.status(404).json({ error: 'Room type not found' });
    }

    if (roomType.hotels?.admin_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden. You do not own this hotel.' });
    }

    // Generate date records between startDate and endDate (inclusive)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const rows = [];
    let curr = new Date(start);

    while (curr <= end) {
      const dateStr = curr.toISOString().split('T')[0];
      const avail = (isAvailable === true || isAvailable === 'true');
      rows.push({
        room_type_id: roomTypeId,
        date: dateStr,
        available_count: avail ? parseInt(availableCount || roomType.total_rooms) : 0,
        is_available: avail
      });
      curr.setDate(curr.getDate() + 1);
    }

    // Create an authenticated client to pass RLS
    const supabaseAuth = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: token } }
    });

    // Upsert date availability records in Supabase
    const { error: upsertError } = await supabaseAuth
      .from('room_availability')
      .upsert(rows, { onConflict: 'room_type_id,date' });

    if (upsertError) throw upsertError;

    // Purge caches for this hotel so updates appear immediately
    try {
      const redis = getRedisClient();
      await redis.del(`hotel:${roomType.hotel_id}`);
      await clearSearchCaches();
    } catch (e) {}

    return res.status(200).json({ success: true, count: rows.length });
  } catch (error) {
    console.error('Availability update error:', error);
    return res.status(500).json({ error: error.message });
  }
}
