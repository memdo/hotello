import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { connectToDatabase } from '../../../src/lib/mongodb.js';
import { getRedisClient } from '../../../src/lib/redis.js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  const { hotelId, page = 1, limit = 10 } = req.query;

  if (req.method === 'GET') {
    try {
      const { db } = await connectToDatabase();
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const take = parseInt(limit);

      const count = await db.collection('comments').countDocuments({ hotel_id: hotelId });
      const comments = await db.collection('comments')
        .find({ hotel_id: hotelId })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(take)
        .toArray();

      return res.status(200).json({
        comments,
        pagination: { page: parseInt(page), limit: take, total: count }
      });
    } catch (error) {
      console.error('Fetch comments error:', error);
      return res.status(500).json({ error: error.message });
    }
  } 
  else if (req.method === 'POST') {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token.replace('Bearer ', ''));
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

    const { 
        ratingOverall, ratingCleanliness, ratingStaff, 
        ratingFacilities, ratingLocation, ratingComfort, commentText 
    } = req.body;

    try {
      // Fetch full_name from Supabase user_profiles
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const { db } = await connectToDatabase();

      const commentDoc = {
        hotel_id: hotelId,
        user_id: user.id,
        rating_overall: parseInt(ratingOverall),
        rating_cleanliness: parseInt(ratingCleanliness),
        rating_staff: parseInt(ratingStaff),
        rating_facilities: parseInt(ratingFacilities),
        rating_location: parseInt(ratingLocation),
        rating_comfort: parseInt(ratingComfort),
        comment_text: commentText,
        user_profiles: {
          full_name: profile?.full_name || 'Anonymous User'
        },
        created_at: new Date()
      };

      await db.collection('comments').insertOne(commentDoc);

      // Invalidate ratings cache
      try {
        const redis = getRedisClient();
        await redis.del(`ratings:${hotelId}`);
      } catch (redisErr) {}

      return res.status(201).json({ success: true });
    } catch (error) {
      console.error('Insert comment error:', error);
      return res.status(400).json({ error: error.message });
    }
  } else {
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
