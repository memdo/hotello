import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Please add your MONGODB_URI to .env.local');
  }

  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // Create a new client if no cached client exists
  const client = await MongoClient.connect(process.env.MONGODB_URI);

  // Extract the default DB from the connection URI
  const db = client.db();

  cachedClient = client;
  cachedDb = db;
  return { client, db };
}
