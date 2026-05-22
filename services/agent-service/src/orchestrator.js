import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { ToolRegistry } from './toolRegistry.js';

export class Orchestrator {
  constructor() {
    this.registry = new ToolRegistry();
    this.client = new Cerebras({
      apiKey: process.env.CEREBRAS_API_KEY || ''
    });
  }

  async initialize() {
    await this.registry.loadTools();
  }

  async chat(userMessage, history, authHeader) {
    if (!process.env.CEREBRAS_API_KEY) {
      throw new Error("CEREBRAS_API_KEY is not configured.");
    }

    // Convert Gemini-style history to OpenAI-style history if needed
    const messages = [
      {
        role: "system",
        content: "You are the Hotello AI Assistant. Your job is to help users find and book hotels. Always use the available tools to retrieve real data and book rooms. Never make up hotel IDs or prices. If a tool fails with an error, apologize and let the user know, or ask for clarification."
      }
    ];

    for (const msg of history) {
      // If it's Gemini format (msg.parts), map it. Otherwise assume standard format.
      if (msg.parts && Array.isArray(msg.parts)) {
        messages.push({
          role: msg.role === 'model' ? 'assistant' : msg.role,
          content: msg.parts[0].text
        });
      } else {
        messages.push({
          role: msg.role === 'model' ? 'assistant' : msg.role,
          content: msg.content
        });
      }
    }

    messages.push({
      role: 'user',
      content: userMessage
    });

    const tools = this.registry.getOpenAIToolDeclarations();

    let isDone = false;
    let finalResponse = '';

    while (!isDone) {
      const completion = await this.client.chat.completions.create({
        messages,
        model: 'gpt-oss-120b',
        tools: tools,
      });

      const message = completion.choices[0].message;
      messages.push(message);

      if (message.tool_calls && message.tool_calls.length > 0) {
        // Execute tools
        for (const call of message.tool_calls) {
          const toolName = call.function.name;
          const toolArgsRaw = call.function.arguments;
          let toolArgs = {};
          
          try {
            toolArgs = JSON.parse(toolArgsRaw);
          } catch (e) {
            console.error(`[AGENT] Failed to parse tool arguments for ${toolName}`);
          }
          
          console.log(`[AGENT] Cerebras called tool: ${toolName}`, toolArgs);

          const tool = this.registry.getTool(toolName);
          if (!tool) {
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              name: toolName,
              content: JSON.stringify({ error: `Tool ${toolName} not found in registry.` })
            });
            continue;
          }

          try {
            const validArgs = tool.schema.parse(toolArgs);
            const context = { authHeader };
            const toolResult = await tool.handler(validArgs, context);
            
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              name: toolName,
              content: JSON.stringify(toolResult)
            });
          } catch (error) {
            console.error(`[AGENT] Tool Execution/Validation Error for ${toolName}:`, error.message);
            let errorMsg = error.message;
            if (error.errors) {
              errorMsg = "Validation failed: " + JSON.stringify(error.errors);
            }
            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              name: toolName,
              content: JSON.stringify({ error: errorMsg })
            });
          }
        }
      } else {
        isDone = true;
        finalResponse = message.content;
      }
    }

    return finalResponse;
  }
}
