import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
import { getRedisClient } from '../../../src/lib/redis.js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { city, checkIn, checkOut, guests, page = 1, limit = 10 } = req.query;
  const token = req.headers.authorization;
  
  let isAuthenticated = false;
  if (token) {
      const { data: { user } } = await supabase.auth.getUser(token.replace('Bearer ', ''));
      if (user) isAuthenticated = true;
  }

  // Cache Key Strategy
  const cacheKey = `search:${city}:${checkIn}:${checkOut}:${guests}:${page}:${limit}`;
  const redis = getRedisClient();
  
  try {
    const cachedResult = await redis.get(cacheKey);
    if (cachedResult) {
      const parsedData = JSON.parse(cachedResult);
      // Apply discount dynamically if auth status changes after cache
      if (isAuthenticated) {
          parsedData.hotels.forEach(h => {
              h.discounted = true;
              h.price_per_night = (h.price_per_night * 0.85).toFixed(2);
          });
      }
      return res.status(200).json(parsedData);
    }
  } catch(e) { console.error('Redis Error', e); }

  // Query Supabase
  try {
    // Basic search simulation - in a real scenario this would be a complex join or a specific RPC view
    // For this demonstration, we query hotels that match the city.
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

    // Gather all room type IDs from the hotels found
    const roomTypeIds = hotels.flatMap(h => (h.room_types || []).map(rt => rt.id));
    const availabilityMap = {};

    // If check-in and check-out dates are provided, fetch exact vacancy records
    if (checkIn && checkOut && roomTypeIds.length > 0) {
      const { data: availabilities, error: availError } = await supabase
        .from('room_availability')
        .select('room_type_id, date, available_count, is_available')
        .in('room_type_id', roomTypeIds)
        .gte('date', checkIn)
        .lt('date', checkOut);

      if (availError) throw availError;

      // Group availability by room type ID and date
      availabilities.forEach(av => {
        if (!availabilityMap[av.room_type_id]) {
          availabilityMap[av.room_type_id] = {};
        }
        availabilityMap[av.room_type_id][av.date] = av;
      });
    }

    const filteredHotels = [];

    // Filter logic: Find hotels that have at least one room type meeting the criteria
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

              // Under the strict allowed vacancy model, room must have an active record
              // with is_available = true and available_count >= 1
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
          // If no search dates are provided, we check if there's any capacity
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
    
    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedHotels = filteredHotels.slice(startIndex, startIndex + parseInt(limit));

    const result = {
      hotels: paginatedHotels,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredHotels.length
      }
    };

    // Cache the pure result (no discount) for 5 minutes
    try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
    } catch(e) {}

    // Apply discount
    if (isAuthenticated) {
        result.hotels.forEach(h => {
            h.discounted = true;
            h.price_per_night = (h.price_per_night * 0.85).toFixed(2);
        });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({ error: error.message });
  }
}
