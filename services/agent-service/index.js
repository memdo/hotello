import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Orchestrator } from './src/orchestrator.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const orchestrator = new Orchestrator();
// Initialize tools on startup
await orchestrator.initialize();

app.post('/api/v1/agent/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    const authHeader = req.headers.authorization; // Extracted JWT token

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    // Process the chat via orchestrator
    const responseText = await orchestrator.chat(message, history || [], authHeader);
    return res.status(200).json({ response: responseText });

  } catch (error) {
    console.error('[AGENT] Chat error:', error);
    return res.status(500).json({ error: 'Failed to process request.' });
  }
});

app.listen(PORT, () => {
  console.log(`[AGENT] Agent Service listening on port ${PORT}`);
});
