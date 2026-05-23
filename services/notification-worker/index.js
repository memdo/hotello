import express from 'express';
import cors from 'cors';
import amqp from 'amqplib';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Resend } from 'resend';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Initialize Resend Client
const resend = new Resend(process.env.RESEND_API_KEY || 're_RjGg4waG_8hFS6L1uWEECAsrk5pqk2n28');

// Helper to send Reservation confirmation email
async function sendReservationEmail(payload) {
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const toEmail = payload.userEmail;

  console.log(`[EMAIL SENDING] Initiating Resend dispatch to ${toEmail} from ${fromEmail}...`);

  const htmlContent = `
    <div style="background-color: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 40px 20px; min-height: 100vh;">
      <div style="max-width: 600px; margin: 0 auto; background: rgba(30, 41, 59, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 40px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);">
        
        <!-- Header with beautiful gradient -->
        <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 32px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.025em; color: #ffffff;">Stay Confirmed! 🎉</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; color: #e2e8f0; opacity: 0.9;">Your reservation is secured at ${payload.hotelName}</p>
        </div>

        <!-- Stay Summary Card -->
        <div style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 24px; margin-bottom: 32px;">
          <h3 style="margin-top: 0; color: #a855f7; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600;">Reservation Details</h3>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <td style="padding: 12px 0; color: #94a3b8;">Reservation ID:</td>
              <td style="padding: 12px 0; text-align: right; font-family: monospace; color: #f8fafc; font-weight: 600;">#${payload.reservationId}</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <td style="padding: 12px 0; color: #94a3b8;">Guest Email:</td>
              <td style="padding: 12px 0; text-align: right; color: #6366f1; font-weight: 600;">${payload.userEmail}</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <td style="padding: 12px 0; color: #94a3b8;">Check-In Date:</td>
              <td style="padding: 12px 0; text-align: right; color: #f8fafc; font-weight: 600;">${payload.checkIn}</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <td style="padding: 12px 0; color: #94a3b8;">Check-Out Date:</td>
              <td style="padding: 12px 0; text-align: right; color: #f8fafc; font-weight: 600;">${payload.checkOut}</td>
            </tr>
            <tr>
              <td style="padding: 16px 0 0 0; color: #94a3b8; font-size: 16px; font-weight: 600;">Total Amount Paid:</td>
              <td style="padding: 16px 0 0 0; text-align: right; color: #34d399; font-size: 20px; font-weight: 700;">$${payload.totalPrice}</td>
            </tr>
          </table>
        </div>

        <!-- Action Button -->
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${process.env.BASE_URL || 'http://localhost:5173'}/profile" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
            View My Reservations
          </a>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 24px; text-align: center; font-size: 12px; color: #64748b;">
          <p style="margin: 0 0 8px 0;">Thank you for choosing Hotello, your next-generation luxury AI hotel assistant.</p>
          <p style="margin: 0;">&copy; 2026 Hotello Inc. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `Booking Confirmed: Stay at ${payload.hotelName}`,
      html: htmlContent
    });

    if (error) {
      console.error(`[EMAIL ERROR] Resend rejected dispatch to ${toEmail}:`, error);
    } else {
      console.log(`[EMAIL SENT] Successfully sent email to ${toEmail} using Resend! ID: ${data?.id}`);
    }
  } catch (err) {
    console.error(`[EMAIL ERROR] Direct error while sending reservation email to ${toEmail}:`, err.message);
  }
}

// Helper to send Room Capacity Warning alerts to Admins
async function sendCapacityAlertEmail(adminEmail, rt) {
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  console.log(`[EMAIL SENDING] Dispatched capacity alert for RoomType #${rt.id} to admin ${adminEmail}...`);

  const htmlContent = `
    <div style="background-color: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 40px 20px; min-height: 100vh;">
      <div style="max-width: 600px; margin: 0 auto; background: rgba(30, 41, 59, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 40px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);">
        
        <!-- Header with Warning design -->
        <div style="background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 32px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.025em; color: #ffffff;">⚠️ Capacity Alert</h1>
          <p style="margin: 8px 0 0 0; font-size: 16px; color: #e2e8f0; opacity: 0.9;">Room type is running low on availability (< 20%)!</p>
        </div>

        <!-- Alert Details Card -->
        <div style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 24px; margin-bottom: 32px;">
          <h3 style="margin-top: 0; color: #f97316; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600;">System Audit Details</h3>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <td style="padding: 12px 0; color: #94a3b8;">Hotel ID:</td>
              <td style="padding: 12px 0; text-align: right; color: #f8fafc; font-weight: 600;">#${rt.hotel_id}</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <td style="padding: 12px 0; color: #94a3b8;">Room Type ID:</td>
              <td style="padding: 12px 0; text-align: right; color: #f8fafc; font-weight: 600;">#${rt.id}</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <td style="padding: 12px 0; color: #94a3b8;">Time Window:</td>
              <td style="padding: 12px 0; text-align: right; color: #f8fafc; font-weight: 600;">Next 30 Days</td>
            </tr>
            <tr>
              <td style="padding: 16px 0 0 0; color: #94a3b8; font-size: 16px; font-weight: 600;">Availability Status:</td>
              <td style="padding: 16px 0 0 0; text-align: right; color: #ef4444; font-size: 18px; font-weight: 700;">&lt; 20% Remaining</td>
            </tr>
          </table>
        </div>

        <!-- Action Button -->
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${process.env.BASE_URL || 'http://localhost:5173'}/admin" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);">
            Manage All Inventory
          </a>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 24px; text-align: center; font-size: 12px; color: #64748b;">
          <p style="margin: 0 0 8px 0;">This email is an automated alert generated by Hotello Capacity Audit System.</p>
          <p style="margin: 0;">&copy; 2026 Hotello Inc. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject: `⚠️ Capacity Warning: Hotello Inventory Low`,
      html: htmlContent
    });

    if (error) {
      console.error(`[EMAIL ERROR] Resend rejected admin capacity alert to ${adminEmail}:`, error);
    } else {
      console.log(`[EMAIL SENT] Successfully sent capacity warning to ${adminEmail} using Resend! ID: ${data?.id}`);
    }
  } catch (err) {
    console.error(`[EMAIL ERROR] Direct error while sending capacity warning to ${adminEmail}:`, err.message);
  }
}

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

    channel.consume('reservation_notifications', async (msg) => {
      if (msg !== null) {
        try {
          const payload = JSON.parse(msg.content.toString());
          await sendReservationEmail(payload);
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
      await sendReservationEmail(payload);
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
          await sendCapacityAlertEmail(adminProfile.email, rt);
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
