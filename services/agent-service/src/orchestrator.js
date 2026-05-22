import { GoogleGenerativeAI } from '@google/generative-ai';
import { ToolRegistry } from './toolRegistry.js';

export class Orchestrator {
  constructor() {
    this.registry = new ToolRegistry();
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  async initialize() {
    await this.registry.loadTools();
  }

  async chat(userMessage, history, authHeader) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: this.registry.getGeminiToolDeclarations(),
      systemInstruction: "You are the Hotello AI Assistant. Your job is to help users find and book hotels. Always use the available tools to retrieve real data and book rooms. Never make up hotel IDs or prices. If a tool fails with an error, apologize and let the user know, or ask for clarification.",
    });

    const chatSession = model.startChat({ history });

    // Send the user message
    let result = await chatSession.sendMessage(userMessage);
    let functionCalls = result.response.functionCalls();

    // Orchestration loop: if Gemini returns a function call, execute it and send the response back
    while (functionCalls && functionCalls.length > 0) {
      const functionResponses = [];

      for (const call of functionCalls) {
        const toolName = call.name;
        const toolArgs = call.args;
        console.log(`[AGENT] Gemini called tool: ${toolName}`, toolArgs);

        const tool = this.registry.getTool(toolName);
        if (!tool) {
          functionResponses.push({
            functionResponse: {
              name: toolName,
              response: { error: `Tool ${toolName} not found in registry.` }
            }
          });
          continue;
        }

        // 1. Strict Validation
        try {
          // Parse inputs with the tool's Zod schema
          const validArgs = tool.schema.parse(toolArgs);
          
          // 2. Execute Handler with Auth Context
          const context = { authHeader };
          const toolResult = await tool.handler(validArgs, context);
          
          functionResponses.push({
            functionResponse: {
              name: toolName,
              response: toolResult
            }
          });
        } catch (error) {
          console.error(`[AGENT] Tool Execution/Validation Error for ${toolName}:`, error.message);
          // 3. Self-correcting feedback: send error back to Gemini
          let errorMsg = error.message;
          if (error.errors) {
            // Zod error
            errorMsg = "Validation failed: " + JSON.stringify(error.errors);
          }
          functionResponses.push({
            functionResponse: {
              name: toolName,
              response: { error: errorMsg }
            }
          });
        }
      }

      // Send the tool results back to Gemini to continue reasoning
      result = await chatSession.sendMessage(functionResponses);
      functionCalls = result.response.functionCalls();
    }

    // Loop ends when Gemini returns a text response instead of function calls
    return result.response.text();
  }
}
