import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export default async function handler(req, res) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  const token = req.headers.authorization;
  const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;

  const tools = [{
    functionDeclarations: [
      {
        name: "search_hotels",
        description: "Searches for hotels based on city, dates, and guests.",
        parameters: {
          type: "OBJECT",
          properties: {
            city: { type: "STRING" },
            checkIn: { type: "STRING", description: "YYYY-MM-DD" },
            checkOut: { type: "STRING", description: "YYYY-MM-DD" },
            guests: { type: "INTEGER" }
          },
          required: ["city"]
        }
      },
      {
        name: "book_hotel",
        description: "Books a hotel room. Requires authentication token.",
        parameters: {
          type: "OBJECT",
          properties: {
            hotelId: { type: "STRING" },
            roomTypeId: { type: "STRING" },
            checkIn: { type: "STRING", description: "YYYY-MM-DD" },
            checkOut: { type: "STRING", description: "YYYY-MM-DD" },
            guests: { type: "INTEGER" }
          },
          required: ["hotelId", "roomTypeId", "checkIn", "checkOut", "guests"]
        }
      }
    ]
  }];

  // Map frontend OpenAI-style messages to Gemini format
  const history = [];
  let latestUserMessage = "";
  
  for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (i === messages.length - 1 && msg.role === 'user') {
          latestUserMessage = msg.content;
      } else {
          history.push({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }]
          });
      }
  }

  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: 'You are a helpful hotel booking assistant. Use the provided tools to search for and book hotels. Format hotel results clearly.',
        tools: tools,
        temperature: 0.2
      },
      history: history.length > 0 ? history : undefined
    });

    const sendMessageWithRetry = async (payload, retries = 2) => {
        try {
            return await chat.sendMessage(payload);
        } catch (error) {
            if (error.status === 429 && retries > 0) {
                console.log(`Rate limited. Retrying in 3s... (${retries} retries left)`);
                await new Promise(resolve => setTimeout(resolve, 3000));
                return await sendMessageWithRetry(payload, retries - 1);
            }
            throw error;
        }
    };

    let response = await sendMessageWithRetry({ message: latestUserMessage });

    // Handle tool calls if any
    if (response.functionCalls && response.functionCalls.length > 0) {
      const toolResults = [];

      for (const call of response.functionCalls) {
        const functionName = call.name;
        const args = call.args;
        let functionResult = {};

        try {
            if (functionName === 'search_hotels') {
                const queryParams = new URLSearchParams(args).toString();
                const searchRes = await fetch(`${baseUrl}/api/v1/hotels/search?${queryParams}`, {
                    headers: token ? { 'Authorization': token } : {}
                });
                functionResult = await searchRes.json();
            } 
            else if (functionName === 'book_hotel') {
                const bookRes = await fetch(`${baseUrl}/api/v1/hotels/book`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token && { 'Authorization': token })
                    },
                    body: JSON.stringify(args)
                });
                functionResult = await bookRes.json();
            }
        } catch(err) {
            functionResult = { error: err.message };
        }

        toolResults.push({
          functionResponse: {
            name: functionName,
            response: functionResult,
            id: call.id
          }
        });
      }

      // Send tool results back to Gemini
      // Send tool results back to Gemini
      response = await sendMessageWithRetry({ message: toolResults });
    }

    // Return in the format expected by the frontend
    return res.status(200).json({ 
        role: 'assistant', 
        content: response.text 
    });

  } catch (error) {
    console.error('Gemini error:', error);
    if (error.status === 429) {
        return res.status(200).json({ 
            role: 'assistant', 
            content: 'The AI is currently receiving too many requests. Please wait a few seconds and try again.' 
        });
    }
    return res.status(500).json({ error: error.message });
  }
}
