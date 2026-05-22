import { z } from 'zod';
import axios from 'axios';

const schema = z.object({
  city: z.string().optional().describe("The city to search for hotels in (e.g., 'Paris', 'New York')."),
  checkIn: z.string().optional().describe("Check-in date in YYYY-MM-DD format."),
  checkOut: z.string().optional().describe("Check-out date in YYYY-MM-DD format."),
  guests: z.number().int().min(1).max(20).optional().describe("Number of guests.")
});

export default {
  name: 'searchHotels',
  description: 'Search for available hotels based on city, dates, and number of guests.',
  schema,
  geminiParameters: {
    type: "OBJECT",
    properties: {
      city: { type: "STRING", description: "The city to search for hotels in (e.g., 'Paris', 'New York')." },
      checkIn: { type: "STRING", description: "Check-in date in YYYY-MM-DD format." },
      checkOut: { type: "STRING", description: "Check-out date in YYYY-MM-DD format." },
      guests: { type: "INTEGER", description: "Number of guests." }
    }
  },
  handler: async (args, context) => {
    try {
      const GATEWAY_URL = process.env.GATEWAY_URL || 'http://gateway:3000';
      const response = await axios.get(`${GATEWAY_URL}/api/v1/hotels/search`, { params: args });
      return response.data;
    } catch (error) {
      if (error.response && error.response.data) {
        throw new Error(error.response.data.error || 'Failed to search hotels');
      }
      throw new Error('Internal error while searching hotels');
    }
  }
};
