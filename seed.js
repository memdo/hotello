import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Seeding database...');
  
  // 1. Insert Hotels
  const { data: hotels, error: hError } = await supabase.from('hotels').insert([
    {
      name: 'Hotel Roma Plaza',
      description: 'Experience luxury in the heart of Rome. Hotel Roma Plaza offers exquisite accommodations with a blend of classic Italian style and modern amenities.',
      address: 'Via Roma 123',
      city: 'Rome',
      country: 'Italy',
      latitude: 41.9028,
      longitude: 12.4964,
      star_rating: 4,
      amenities: ['Free Wi-Fi', 'Breakfast', 'Pool']
    },
    {
      name: 'Grand Hotel Monti',
      description: 'A five-star experience near the Colosseum.',
      address: 'Via Monti 45',
      city: 'Rome',
      country: 'Italy',
      latitude: 41.8950,
      longitude: 12.4920,
      star_rating: 5,
      amenities: ['Spa', 'Gym', 'Restaurant']
    },
    {
        name: 'The Parisien',
        description: 'Beautiful hotel near the Eiffel Tower.',
        address: '12 Rue de Paris',
        city: 'Paris',
        country: 'France',
        latitude: 48.8584,
        longitude: 2.2945,
        star_rating: 5,
        amenities: ['Free Wi-Fi', 'Balcony', 'Room Service']
    }
  ]).select();

  if (hError) {
      console.error('Error inserting hotels:', hError);
      return;
  }

  // 2. Insert Room Types
  for (const hotel of hotels) {
      const { data: roomTypes, error: rtError } = await supabase.from('room_types').insert([
          {
              hotel_id: hotel.id,
              name: 'Standard Room',
              capacity: 2,
              price_per_night: hotel.star_rating === 5 ? 350 : 210,
              total_rooms: 10
          },
          {
              hotel_id: hotel.id,
              name: 'Family Suite',
              capacity: 4,
              price_per_night: hotel.star_rating === 5 ? 500 : 350,
              total_rooms: 5
          }
      ]).select();

      if (rtError) {
          console.error('Error inserting room types:', rtError);
          return;
      }

      // 3. Insert Availability for next 30 days
      const availability = [];
      let curr = new Date('2026-05-15');
      let end = new Date('2026-06-30');
      
      while (curr <= end) {
          for (const rt of roomTypes) {
              availability.push({
                  room_type_id: rt.id,
                  date: curr.toISOString().split('T')[0],
                  available_count: rt.total_rooms,
                  is_available: true
              });
          }
          curr.setDate(curr.getDate() + 1);
      }

      await supabase.from('room_availability').insert(availability);
  }

  console.log('Seeding complete! Added 3 hotels with rooms and availability.');
}

seed();
