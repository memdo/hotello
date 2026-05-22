import { z } from 'zod';
import axios from 'axios';

const schema = z.object({
  hotelId: z.string().describe("The UUID of the hotel."),
  roomTypeId: z.string().describe("The UUID of the room type to book."),
  checkIn: z.string().describe("Check-in date in YYYY-MM-DD format."),
  checkOut: z.string().describe("Check-out date in YYYY-MM-DD format."),
  guests: z.number().int().min(1).max(20).describe("Number of guests."),
  guestName: z.string().optional().describe("The guest's full name. Required if the user is not logged in."),
  guestEmail: z.string().optional().describe("The guest's email address. Required if the user is not logged in.")
});

export default {
  name: 'bookRoom',
  description: 'Book a room at a hotel. IMPORTANT: You MUST use the exact UUIDs for hotelId and roomTypeId obtained from calling searchHotels and getHotelDetails. DO NOT guess or make up IDs. If the user is logged out (or if you are not sure), you MUST ask the user for their name and email address before calling this tool. Make sure you have all required parameters before calling this.',
  schema,
  geminiParameters: {
    type: "OBJECT",
    properties: {
      hotelId: { type: "STRING", description: "The EXACT UUID of the hotel (obtained from searchHotels)." },
      roomTypeId: { type: "STRING", description: "The EXACT UUID of the room type to book (obtained from getHotelDetails)." },
      checkIn: { type: "STRING", description: "Check-in date in YYYY-MM-DD format." },
      checkOut: { type: "STRING", description: "Check-out date in YYYY-MM-DD format." },
      guests: { type: "INTEGER", description: "Number of guests." },
      guestName: { type: "STRING", description: "The guest's full name. Provide this if the user is not logged in." },
      guestEmail: { type: "STRING", description: "The guest's email address. Provide this if the user is not logged in." }
    },
    required: ["hotelId", "roomTypeId", "checkIn", "checkOut", "guests"]
  },
  handler: async (args, context) => {
    try {
      if (!context.authHeader) {
        if (!args.guestName || !args.guestEmail) {
          throw new Error('User is not authenticated. You MUST ask the user for their name and email address before you can book the room.');
        }
      }
      const GATEWAY_URL = process.env.GATEWAY_URL || 'http://gateway:3000';
      const response = await axios.post(`${GATEWAY_URL}/api/v1/hotels/book`, args, {
        headers: {
          Authorization: context.authHeader
        }
      });
      return response.data;
    } catch (error) {
      if (error.response && error.response.data) {
        throw new Error(error.response.data.error || 'Failed to book room');
      }
      throw new Error(error.message || 'Internal error while booking room');
    }
  }
};
