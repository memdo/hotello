import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); // Requires service role for admin emails

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify CRON Secret from Azure Logic Apps
  const cronSecret = req.headers['x-cron-secret'];
  if (cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized CRON trigger' });
  }

  try {
    // 1. Get all room types and their total capacities
    const { data: roomTypes, error: rtError } = await supabase
        .from('room_types')
        .select('id, hotel_id, total_rooms, hotels(admin_id)');
    
    if (rtError) throw rtError;

    // 2. Get reservations for the next 30 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextMonth = new Date(today);
    nextMonth.setDate(nextMonth.getDate() + 30);

    const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('*')
        .eq('status', 'confirmed')
        .lt('check_in', nextMonth.toISOString().split('T')[0])
        .gt('check_out', today.toISOString().split('T')[0]);

    if (resError) throw resError;

    const notificationsSent = [];

    // Helper to calculate reserved nights falling within the 30-day window
    const getReservedDaysInWindow = (checkInStr, checkOutStr, startWindow, endWindow) => {
        let checkIn = new Date(checkInStr);
        let checkOut = new Date(checkOutStr);
        let start = checkIn < startWindow ? startWindow : checkIn;
        let end = checkOut > endWindow ? endWindow : checkOut;
        if (start >= end) return 0;
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    };

    // 3. Calculate capacity day-by-day
    for (const rt of roomTypes) {
        const rtReservations = reservations.filter(r => r.room_type_id === rt.id);
        const totalPossibleRoomNights = rt.total_rooms * 30; // total capacity in the next 30 days
        
        let reservedRoomNights = 0;
        for (const resv of rtReservations) {
            reservedRoomNights += getReservedDaysInWindow(resv.check_in, resv.check_out, today, nextMonth);
        }

        const currentlyAvailableRoomNights = totalPossibleRoomNights - reservedRoomNights;
        const availabilityPercentage = (currentlyAvailableRoomNights / totalPossibleRoomNights) * 100;

        // If availability is below 20%, trigger notification
        if (availabilityPercentage < 20) {
            // Find admin email
            const { data: adminProfile } = await supabase
                .from('user_profiles')
                .select('email')
                .eq('id', rt.hotels.admin_id)
                .single();

            if (adminProfile?.email) {
                // In a real app, send an email via Resend, SendGrid, or Supabase Edge Functions.
                // We'll log it for the assignment.
                console.log(`[ALERT] Sending email to ${adminProfile.email}: Hotel ${rt.hotel_id} RoomType ${rt.id} is running low on capacity (< 20%) for the next month.`);
                notificationsSent.push({ hotelId: rt.hotel_id, email: adminProfile.email });
            }
        }
    }

    return res.status(200).json({ success: true, processed: roomTypes.length, notificationsSent });

  } catch (error) {
    console.error('Capacity check error:', error);
    return res.status(500).json({ error: error.message });
  }
}
