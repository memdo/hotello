import { getChannel } from '../../../src/lib/rabbitmq.js';

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
        console.log(`[QUEUE] Processing reservation for ${payload.userEmail} at ${payload.hotelName}. Total: $${payload.totalPrice}`);
        // Here you would integrate with an email provider (SendGrid, etc)

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
