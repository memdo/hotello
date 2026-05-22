import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
import { getRedisClient, clearSearchCaches } from '../../../src/lib/redis.js';
import { publishReservation } from '../../../src/lib/rabbitmq.js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token.replace('Bearer ', ''));
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const { hotelId, roomTypeId, checkIn, checkOut, guests } = req.body;

  try {
    // 1. Get Room Price
    const { data: roomType, error: rtError } = await supabase
      .from('room_types')
      .select('price_per_night, hotels(name)')
      .eq('id', roomTypeId)
      .single();
      
    if (rtError || !roomType) throw new Error('Room type not found');

    // 2. Calculate price (apply 15% discount because user is authenticated)
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    if (nights <= 0) throw new Error('Invalid dates');
    
    const basePrice = roomType.price_per_night * nights;
    const discountedPrice = basePrice * 0.85;

    // 3. Execute RPC for atomic booking
    // Create a client with the user's JWT so RLS policies allow the insert
    const supabaseAuth = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: token } }
    });

    const { data: reservationId, error: rpcError } = await supabaseAuth.rpc('book_room', {
      p_user_id: user.id,
      p_hotel_id: hotelId,
      p_room_type_id: roomTypeId,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_guests: parseInt(guests),
      p_total_price: discountedPrice
    });

    if (rpcError) throw rpcError;

    // 4. Publish to Queue
    try {
        await publishReservation({
            reservationId,
            userEmail: user.email,
            hotelName: roomType.hotels.name,
            checkIn,
            checkOut,
            totalPrice: discountedPrice
        });
    } catch(queueError) {
        console.error('Queue publish failed but booking succeeded', queueError);
    }

    // 5. Invalidate caches
    try {
        const redis = getRedisClient();
        await redis.del(`hotel:${hotelId}`);
        await clearSearchCaches();
    } catch(redisError) {}

    return res.status(200).json({ success: true, reservationId, totalPrice: discountedPrice });
  } catch (error) {
    console.error('Booking error:', error);
    return res.status(400).json({ error: error.message });
  }
}
