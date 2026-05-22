import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import amqp from 'amqplib';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ==========================================
// VALIDATION HELPERS
// ==========================================
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

function isValidDateString(str) {
  if (typeof str !== 'string' || !DATE_REGEX.test(str)) return false;
  const d = new Date(str + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().startsWith(str);
}

function isIntInRange(val, min, max) {
  const n = parseInt(val, 10);
  return !isNaN(n) && n >= min && n <= max;
}

function isFloatPositive(val) {
  const n = parseFloat(val);
  return !isNaN(n) && n > 0;
}

function clampInt(val, min, max, defaultVal) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return defaultVal;
  return Math.max(min, Math.min(max, n));
}

function sanitizeError(error) {
  return 'An internal error occurred. Please try again later.';
}

// 1. Supabase Client Setup
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// 2. Redis Client Helper
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

async function clearSearchCaches() {
  try {
    const redis = getRedisClient();
    if (!redis) return;
    let cursor = '0';
    do {
      const [newCursor, keys] = await redis.scan(cursor, 'MATCH', 'search:*', 'COUNT', 100);
      cursor = newCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    console.error('Error clearing search caches:', err);
  }
}

// 3. RabbitMQ Helper
let rabbitChannel = null;
async function getRabbitChannel() {
  if (rabbitChannel) return rabbitChannel;
  if (!process.env.CLOUDAMQP_URL) return null;
  try {
    const conn = await amqp.connect(process.env.CLOUDAMQP_URL);
    rabbitChannel = await conn.createChannel();
    await rabbitChannel.assertQueue('reservation_notifications', { durable: true });
    return rabbitChannel;
  } catch (error) {
    console.error("Failed to connect to RabbitMQ", error);
    return null;
  }
}

async function publishReservation(data) {
  try {
    const ch = await getRabbitChannel();
    if (!ch) return;
    ch.sendToQueue(
      'reservation_notifications',
      Buffer.from(JSON.stringify(data)),
      { persistent: true }
    );
  } catch (e) {
    console.error('Failed to publish reservation to RabbitMQ queue', e);
  }
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

// GET /api/v1/hotels/locations
app.get('/api/v1/hotels/locations', async (req, res) => {
  const cacheKey = `search:locations`;
  const redis = getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (e) { }
  }

  try {
    const { data, error } = await supabase.from('hotels').select('city');
    if (error) throw error;

    const cities = [...new Set(data.map(h => h.city))].filter(Boolean).sort();

    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(cities), 'EX', 3600);
      } catch (e) { }
    }

    return res.status(200).json(cities);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/hotels/search
app.get('/api/v1/hotels/search', async (req, res) => {
  const { city, checkIn, checkOut, guests } = req.query;
  const page = clampInt(req.query.page, 1, 1000, 1);
  const limit = clampInt(req.query.limit, 1, 50, 10);

  // Validate date formats if provided
  if (checkIn && !isValidDateString(checkIn)) {
    return res.status(400).json({ error: 'Invalid checkIn date format. Use YYYY-MM-DD.' });
  }
  if (checkOut && !isValidDateString(checkOut)) {
    return res.status(400).json({ error: 'Invalid checkOut date format. Use YYYY-MM-DD.' });
  }
  if (checkIn && checkOut && checkOut <= checkIn) {
    return res.status(400).json({ error: 'checkOut must be after checkIn.' });
  }
  if (guests && !isIntInRange(guests, 1, 20)) {
    return res.status(400).json({ error: 'guests must be an integer between 1 and 20.' });
  }

  const user = await authenticateToken(req);
  const isAuthenticated = !!user;

  const cacheKey = `search:${city}:${checkIn}:${checkOut}:${guests}:${page}:${limit}`;
  const redis = getRedisClient();

  if (redis) {
    try {
      const cachedResult = await redis.get(cacheKey);
      if (cachedResult) {
        const parsedData = JSON.parse(cachedResult);
        if (isAuthenticated) {
          parsedData.hotels.forEach(h => {
            h.discounted = true;
            h.price_per_night = (h.price_per_night * 0.85).toFixed(2);
          });
        }
        return res.status(200).json(parsedData);
      }
    } catch (e) { console.error('Redis Error', e); }
  }

  try {
    let query = supabase.from('hotels').select(`
        *,
        room_types (
            id, name, capacity, price_per_night
        )
    `);

    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    const { data: hotels, error } = await query;
    if (error) throw error;

    const roomTypeIds = hotels.flatMap(h => (h.room_types || []).map(rt => rt.id));
    const availabilityMap = {};

    if (checkIn && checkOut && roomTypeIds.length > 0) {
      const { data: availabilities, error: availError } = await supabase
        .from('room_availability')
        .select('room_type_id, date, available_count, is_available')
        .in('room_type_id', roomTypeIds)
        .gte('date', checkIn)
        .lt('date', checkOut);

      if (availError) throw availError;

      availabilities.forEach(av => {
        if (!availabilityMap[av.room_type_id]) {
          availabilityMap[av.room_type_id] = {};
        }
        availabilityMap[av.room_type_id][av.date] = av;
      });
    }

    const filteredHotels = [];

    for (const hotel of hotels) {
      let minPrice = Infinity;
      let hasValidRoom = false;

      for (const rt of hotel.room_types) {
        if (guests && rt.capacity < parseInt(guests)) continue;

        let isAvailable = true;

        if (checkIn && checkOut) {
          const start = new Date(checkIn);
          const end = new Date(checkOut);
          let curr = new Date(start);
          const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

          if (nights <= 0) {
            isAvailable = false;
          } else {
            let daysChecked = 0;
            while (curr < end) {
              const dateStr = curr.toISOString().split('T')[0];
              const dayAvail = availabilityMap[rt.id]?.[dateStr];

              if (!dayAvail || !dayAvail.is_available || dayAvail.available_count < 1) {
                isAvailable = false;
                break;
              }
              daysChecked++;
              curr.setDate(curr.getDate() + 1);
            }
            if (daysChecked < nights) {
              isAvailable = false;
            }
          }
        } else {
          if (rt.total_rooms < 1) {
            isAvailable = false;
          }
        }

        if (isAvailable) {
          hasValidRoom = true;
          if (rt.price_per_night < minPrice) minPrice = rt.price_per_night;
        }
      }

      if (hasValidRoom) {
        filteredHotels.push({
          id: hotel.id,
          name: hotel.name,
          city: hotel.city,
          star_rating: hotel.star_rating,
          amenities: hotel.amenities,
          image_url: hotel.image_url,
          latitude: hotel.latitude,
          longitude: hotel.longitude,
          price_per_night: minPrice,
          discounted: false
        });
      }
    }

    const startIndex = (page - 1) * limit;
    const paginatedHotels = filteredHotels.slice(startIndex, startIndex + limit);

    const result = {
      hotels: paginatedHotels,
      pagination: {
        page,
        limit,
        total: filteredHotels.length
      }
    };

    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
      } catch (e) { }
    }

    if (isAuthenticated) {
      result.hotels.forEach(h => {
        h.discounted = true;
        h.price_per_night = (h.price_per_night * 0.85).toFixed(2);
      });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: sanitizeError(error) });
  }
});

// GET /api/v1/hotels/reservations
app.get('/api/v1/hotels/reservations', async (req, res) => {
  const token = req.headers.authorization;
  const user = await authenticateToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const supabaseAuth = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: token } }
    });

    const { data: reservations, error } = await supabaseAuth
      .from('reservations')
      .select(`
        *,
        hotels (
          id, name, city, country, image_url
        ),
        room_types (
          id, name
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json(reservations);
  } catch (error) {
    console.error('Fetch reservations error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/v1/hotels/reservations/:id/cancel
app.put('/api/v1/hotels/reservations/:id/cancel', async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) return res.status(400).json({ error: 'Invalid reservation ID format.' });

  const user = await authenticateToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const supabaseService = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: reservation, error: fetchError } = await supabaseService
      .from('reservations')
      .select('user_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !reservation) return res.status(404).json({ error: 'Reservation not found' });
    if (reservation.user_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
    if (reservation.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    const { error: updateError } = await supabaseService
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (updateError) throw updateError;

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Cancel reservation error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/hotels/:id
app.get('/api/v1/hotels/:id', async (req, res) => {
  const { id } = req.params;
  const user = await authenticateToken(req);
  const isAuthenticated = !!user;

  const cacheKey = `hotel:${id}`;
  const redis = getRedisClient();

  if (redis) {
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
    } catch (e) { console.error('Redis Error', e); }
  }

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

    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(hotel), 'EX', 86400); // Cache for 24 hours
      } catch (e) { }
    }

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
});

// POST /api/v1/hotels/book
app.post('/api/v1/hotels/book', async (req, res) => {
  const token = req.headers.authorization;
  const user = await authenticateToken(req);

  const { hotelId, roomTypeId, checkIn, checkOut, guests, guestName, guestEmail } = req.body;

  // Validate authentication or guest details
  if (!user) {
    if (!guestName || !guestEmail) {
      return res.status(401).json({ error: 'Unauthorized. Please log in or provide guestName and guestEmail.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestEmail)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }
  }

  // Validate required fields
  const missing = [];
  if (!hotelId) missing.push('hotelId');
  if (!roomTypeId) missing.push('roomTypeId');
  if (!checkIn) missing.push('checkIn');
  if (!checkOut) missing.push('checkOut');
  if (!guests) missing.push('guests');
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  // Validate field formats
  if (!isValidUUID(hotelId)) return res.status(400).json({ error: 'Invalid hotelId format.' });
  if (!isValidUUID(roomTypeId)) return res.status(400).json({ error: 'Invalid roomTypeId format.' });
  if (!isValidDateString(checkIn)) return res.status(400).json({ error: 'Invalid checkIn date. Use YYYY-MM-DD.' });
  if (!isValidDateString(checkOut)) return res.status(400).json({ error: 'Invalid checkOut date. Use YYYY-MM-DD.' });
  if (!isIntInRange(guests, 1, 20)) return res.status(400).json({ error: 'guests must be an integer between 1 and 20.' });

  // Validate date logic
  const today = new Date().toISOString().split('T')[0];
  if (checkIn < today) return res.status(400).json({ error: 'checkIn date cannot be in the past.' });
  if (checkOut <= checkIn) return res.status(400).json({ error: 'checkOut must be after checkIn.' });

  try {
    const { data: roomType, error: rtError } = await supabase
      .from('room_types')
      .select('price_per_night, hotel_id, hotels(id, name)')
      .eq('id', roomTypeId)
      .single();
      
    if (rtError || !roomType) return res.status(404).json({ error: 'Room type not found.' });
    if (roomType.hotel_id !== hotelId) return res.status(400).json({ error: 'Room type does not belong to the specified hotel.' });

    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    if (nights <= 0) return res.status(400).json({ error: 'Invalid date range.' });

    const basePrice = roomType.price_per_night * nights;
    const discountedPrice = basePrice * 0.85;

    // Decide which Supabase client to use for the RPC
    // If authenticated, use the user's token. If anonymous, use the service role key to bypass RLS.
    const supabaseClient = user 
      ? createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: token } }
        })
      : createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: reservationId, error: rpcError } = await supabaseClient.rpc('book_room', {
      p_user_id: user ? user.id : null,
      p_hotel_id: hotelId,
      p_room_type_id: roomTypeId,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_guests: parseInt(guests),
      p_total_price: discountedPrice,
      p_guest_name: user ? null : guestName,
      p_guest_email: user ? null : guestEmail
    });

    if (rpcError) throw rpcError;

    // Publish reservation to RabbitMQ
    const userEmail = user ? user.email : guestEmail;
    await publishReservation({
      reservationId,
      userEmail,
      hotelName: roomType.hotels.name,
      checkIn,
      checkOut,
      totalPrice: discountedPrice
    });

    // Invalidate caches
    try {
      await clearSearchCaches();
    } catch (redisError) { }

    return res.status(200).json({ success: true, reservationId, totalPrice: discountedPrice });
  } catch (error) {
    console.error('Booking error:', error);
    return res.status(400).json({ error: sanitizeError(error) });
  }
});

// POST /api/v1/hotels/admin/rooms
app.post('/api/v1/hotels/admin/rooms', async (req, res) => {
  const token = req.headers.authorization;
  const user = await authenticateToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // Verify Admin Role
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admin only.' });

  const { hotelId, name, capacity, pricePerNight, totalRooms } = req.body;

  // Validate fields
  if (!hotelId || !isValidUUID(hotelId)) return res.status(400).json({ error: 'Invalid or missing hotelId.' });
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
    return res.status(400).json({ error: 'name is required and must be 1-100 characters.' });
  }
  if (!isIntInRange(capacity, 1, 100)) return res.status(400).json({ error: 'capacity must be an integer between 1 and 100.' });
  if (!isFloatPositive(pricePerNight)) return res.status(400).json({ error: 'pricePerNight must be a positive number.' });
  if (!isIntInRange(totalRooms, 1, 1000)) return res.status(400).json({ error: 'totalRooms must be an integer between 1 and 1000.' });

  // Check if admin owns this hotel
  const { data: hotel } = await supabase.from('hotels').select('admin_id').eq('id', hotelId).single();
  if (!hotel) return res.status(404).json({ error: 'Hotel not found.' });
  if (hotel.admin_id !== user.id) return res.status(403).json({ error: 'You do not own this hotel.' });

  const { data, error } = await supabase.from('room_types').insert([{
    hotel_id: hotelId,
    name: name.trim(),
    capacity: parseInt(capacity, 10),
    price_per_night: parseFloat(pricePerNight),
    total_rooms: parseInt(totalRooms, 10)
  }]);

  if (error) return res.status(400).json({ error: error.message });

  try {
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`hotel:${hotelId}`);
    }
    await clearSearchCaches();
  } catch (e) { }

  return res.status(201).json({ success: true });
});

// PUT /api/v1/hotels/admin/rooms
app.put('/api/v1/hotels/admin/rooms', async (req, res) => {
  const token = req.headers.authorization;
  const user = await authenticateToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // Verify Admin Role
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admin only.' });

  const { id, name, capacity, pricePerNight, totalRooms } = req.body;

  // Validate fields
  if (!id || !isValidUUID(id)) return res.status(400).json({ error: 'Invalid or missing room type id.' });
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
    return res.status(400).json({ error: 'name is required and must be 1-100 characters.' });
  }
  if (!isIntInRange(capacity, 1, 100)) return res.status(400).json({ error: 'capacity must be an integer between 1 and 100.' });
  if (!isFloatPositive(pricePerNight)) return res.status(400).json({ error: 'pricePerNight must be a positive number.' });
  if (!isIntInRange(totalRooms, 1, 1000)) return res.status(400).json({ error: 'totalRooms must be an integer between 1 and 1000.' });

  const { data: rt } = await supabase.from('room_types').select('hotel_id').eq('id', id).single();
  if (!rt) return res.status(404).json({ error: 'Room type not found.' });
  const hotelId = rt.hotel_id;

  // Verify ownership
  const { data: hotelOwner } = await supabase.from('hotels').select('admin_id').eq('id', hotelId).single();
  if (!hotelOwner || hotelOwner.admin_id !== user.id) return res.status(403).json({ error: 'You do not own this hotel.' });

  const { error } = await supabase.from('room_types').update({
    name: name.trim(), capacity: parseInt(capacity, 10), price_per_night: parseFloat(pricePerNight), total_rooms: parseInt(totalRooms, 10)
  }).eq('id', id);

  if (error) return res.status(400).json({ error: 'Failed to update room type.' });

  if (hotelId) {
    try {
      const redis = getRedisClient();
      if (redis) {
        await redis.del(`hotel:${hotelId}`);
      }
      await clearSearchCaches();
    } catch (e) { }
  }

  return res.status(200).json({ success: true });
});

// POST /api/v1/hotels/admin/availability
app.post('/api/v1/hotels/admin/availability', async (req, res) => {
  const token = req.headers.authorization;
  const user = await authenticateToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // Verify Admin Role
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admin only.' });

  const { roomTypeId, startDate, endDate, isAvailable, availableCount } = req.body;

  if (!roomTypeId || !startDate || !endDate) {
    return res.status(400).json({ error: 'Missing required parameters: roomTypeId, startDate, endDate' });
  }
  if (!isValidUUID(roomTypeId)) return res.status(400).json({ error: 'Invalid roomTypeId format.' });
  if (!isValidDateString(startDate)) return res.status(400).json({ error: 'Invalid startDate format. Use YYYY-MM-DD.' });
  if (!isValidDateString(endDate)) return res.status(400).json({ error: 'Invalid endDate format. Use YYYY-MM-DD.' });
  if (endDate < startDate) return res.status(400).json({ error: 'endDate must be on or after startDate.' });

  // Cap range to 365 days
  const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
  if (daysDiff > 365) return res.status(400).json({ error: 'Date range cannot exceed 365 days.' });

  try {
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

    const supabaseAuth = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: token } }
    });

    const { error: upsertError } = await supabaseAuth
      .from('room_availability')
      .upsert(rows, { onConflict: 'room_type_id,date' });

    if (upsertError) throw upsertError;

    try {
      const redis = getRedisClient();
      if (redis) {
        await redis.del(`hotel:${roomType.hotel_id}`);
      }
      await clearSearchCaches();
    } catch (e) { }

    return res.status(200).json({ success: true, count: rows.length });
  } catch (error) {
    console.error('Availability update error:', error);
    return res.status(500).json({ error: error.message });
  }
});



app.listen(PORT, () => {
  console.log(`Core Hotel & Search Service running on port ${PORT}`);
});
