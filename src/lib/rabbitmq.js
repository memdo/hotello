import amqp from 'amqplib';

let channel = null;

export async function getChannel() {
  if (channel) return channel;
  
  try {
    const conn = await amqp.connect(process.env.CLOUDAMQP_URL);
    channel = await conn.createChannel();
    await channel.assertQueue('reservation_notifications', { durable: true });
    return channel;
  } catch (error) {
    console.error("Failed to connect to RabbitMQ", error);
    throw error;
  }
}

export async function publishReservation(data) {
  const ch = await getChannel();
  ch.sendToQueue(
    'reservation_notifications', 
    Buffer.from(JSON.stringify(data)), 
    { persistent: true }
  );
}
