import { getChannel } from '../../../src/lib/rabbitmq.js';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY || 're_RjGg4waG_8hFS6L1uWEECAsrk5pqk2n28');

// Helper to send Reservation confirmation email
async function sendReservationEmail(payload) {
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const toEmail = payload.userEmail;

  console.log(`[SERVERLESS QUEUE] Dispatching Resend email to ${toEmail} from ${fromEmail}...`);

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
      console.error(`[SERVERLESS QUEUE ERROR] Resend rejected dispatch to ${toEmail}:`, error);
    } else {
      console.log(`[SERVERLESS QUEUE SENT] Successfully sent email to ${toEmail} using Resend! ID: ${data?.id}`);
    }
  } catch (err) {
    console.error(`[SERVERLESS QUEUE ERROR] Direct error while sending reservation email to ${toEmail}:`, err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify CRON Secret from Azure Logic Apps
  const cronSecret = req.headers['x-cron-secret'];
  if (cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized CRON trigger' });
  }

  try {
    const channel = await getChannel();
    let processedCount = 0;

    // Get message without subscribing (ideal for a periodic cron job on serverless)
    let msg = await channel.get('reservation_notifications');
    
    while (msg !== false) {
        const payload = JSON.parse(msg.content.toString());
        
        // Process message: send email
        await sendReservationEmail(payload);

        channel.ack(msg);
        processedCount++;
        
        // Get next
        msg = await channel.get('reservation_notifications');
        
        // Safety limit to prevent serverless function timeout
        if (processedCount >= 50) break;
    }

    return res.status(200).json({ success: true, processedCount });

  } catch (error) {
    console.error('Queue processing error:', error);
    return res.status(500).json({ error: error.message });
  }
}
