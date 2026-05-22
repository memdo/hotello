import express from 'express';
import cors from 'cors';
import amqp from 'amqplib';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 1. Supabase Client Setup (Requires Supabase service role for admin profiles reading/admin actions)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// 2. Active Queue Consumer
async function startQueueListener() {
  if (!process.env.CLOUDAMQP_URL) {
    console.warn('[WORKER] CLOUDAMQP_URL not specified, skipping active queue consumer');
    return;
  }

  try {
    const conn = await amqp.connect(process.env.CLOUDAMQP_URL);
    const channel = await conn.createChannel();
    await channel.assertQueue('reservation_notifications', { durable: true });

    console.log('[WORKER] Standing by for new reservations on RabbitMQ queue...');

    channel.consume('reservation_notifications', (msg) => {
      if (msg !== null) {
        try {
          const payload = JSON.parse(msg.content.toString());
          console.log(`[ALERT/EMAIL] Sending reservation email to ${payload.userEmail} for stay at ${payload.hotelName}. Total: $${payload.totalPrice}`);
          channel.ack(msg);
        } catch (err) {
          console.error('[WORKER] Error processing message from queue:', err);
          // reject and don't requeue if payload is corrupt
          channel.nack(msg, false, false);
        }
      }
    }, { noAck: false });

    // Handle connection close / error
    conn.on('close', () => {
      console.warn('[WORKER] RabbitMQ connection closed. Reconnecting in 10s...');
      setTimeout(startQueueListener, 10000);
    });

    conn.on('error', (err) => {
      console.error('[WORKER] RabbitMQ connection error:', err);
    });

  } catch (error) {
    console.error('[WORKER] RabbitMQ queue connection error, retrying in 10s...', error);
    setTimeout(startQueueListener, 10000);
  }
}

// 2.5 Passive Queue Processing Endpoint (To be triggered externally)
app.post('/api/v1/notifications/process-queue', async (req, res) => {
  const cronSecret = req.headers['x-cron-secret'];
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || cronSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized CRON trigger' });
  }

  try {
    if (!process.env.CLOUDAMQP_URL) {
      return res.status(500).json({ error: 'CLOUDAMQP_URL not specified' });
    }
    const conn = await amqp.connect(process.env.CLOUDAMQP_URL);
    const channel = await conn.createChannel();
    await channel.assertQueue('reservation_notifications', { durable: true });

    let processedCount = 0;
    // Get message without subscribing (ideal for a periodic cron job)
    let msg = await channel.get('reservation_notifications');
    
    while (msg !== false) {
      const payload = JSON.parse(msg.content.toString());
      console.log(`[SCHEDULED CRON] Processing reservation email to ${payload.userEmail} for stay at ${payload.hotelName}. Total: $${payload.totalPrice}`);
      channel.ack(msg);
      processedCount++;
      
      msg = await channel.get('reservation_notifications');
      if (processedCount >= 50) break; // Safety limit
    }
    
    await channel.close();
    await conn.close();

    return res.status(200).json({ success: true, processedCount });
  } catch (error) {
    console.error('[PASSIVE CRON] Queue processing error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 3. Passive Capacity Check Endpoint (To be triggered externally by Cloud Cron/Logic Apps)
app.post('/api/v1/notifications/capacity-check', async (req, res) => {
  const cronSecret = req.headers['x-cron-secret'];
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('[PASSIVE CRON] CRON_SECRET environment variable is not set. Rejecting request.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }
  if (!cronSecret || typeof cronSecret !== 'string') {
    return res.status(401).json({ error: 'Unauthorized CRON trigger' });
  }

  // Timing-safe comparison to prevent timing attacks
  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(expectedSecret, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Unauthorized CRON trigger' });
    }
  } catch {
    return res.status(401).json({ error: 'Unauthorized CRON trigger' });
  }

  console.log('[PASSIVE CRON] Received trigger for room capacity auditing...');
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

      if (totalPossibleRoomNights === 0) continue;

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
          .eq('id', rt.hotels?.admin_id)
          .single();

        if (adminProfile?.email) {
          // In a real app, send an email via Resend, SendGrid, etc.
          console.log(`[ALERT] Low capacity on RoomType ${rt.id} (< 20%) for the next month. Admin email: ${adminProfile.email}`);
          notificationsSent.push({ hotelId: rt.hotel_id, email: adminProfile.email });
        }
      }
    }

    return res.status(200).json({ success: true, processed: roomTypes.length, notificationsSent });

  } catch (error) {
    console.error('[PASSIVE CRON] Capacity check error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Start the RabbitMQ active consumer in background
startQueueListener();

app.listen(PORT, () => {
  console.log(`Notification Worker listening on port ${PORT}`);
});
