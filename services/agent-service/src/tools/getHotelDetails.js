import { z } from 'zod';
import axios from 'axios';

const schema = z.object({
  hotelId: z.string().describe("The UUID of the hotel to get details for.")
});

export default {
  name: 'getHotelDetails',
  description: 'Get detailed information about a specific hotel, including its available room types, pricing, and amenities.',
  schema,
  geminiParameters: {
    type: "OBJECT",
    properties: {
      hotelId: { type: "STRING", description: "The UUID of the hotel to get details for." }
    },
    required: ["hotelId"]
  },
  handler: async (args, context) => {
    try {
      const GATEWAY_URL = process.env.GATEWAY_URL || 'http://gateway:3000';
      const response = await axios.get(`${GATEWAY_URL}/api/v1/hotels/${args.hotelId}`, {
        headers: {
          Authorization: context.authHeader
        }
      });
      return response.data;
    } catch (error) {
      if (error.response && error.response.data) {
        throw new Error(error.response.data.error || 'Failed to get hotel details');
      }
      throw new Error('Internal error while getting hotel details');
    }
  }
};
