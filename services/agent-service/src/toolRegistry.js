import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { zodToJsonSchema } from 'zod-to-json-schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  async loadTools() {
    const toolsDir = path.join(__dirname, 'tools');
    const files = await fs.readdir(toolsDir);
    
    for (const file of files) {
      if (file.endsWith('.js')) {
        const toolModule = await import(`file://${path.join(toolsDir, file)}`);
        if (toolModule.default) {
          const tool = toolModule.default;
          this.tools.set(tool.name, tool);
          console.log(`[REGISTRY] Loaded tool: ${tool.name}`);
        }
      }
    }
  }

  getTool(name) {
    return this.tools.get(name);
  }

  getGeminiToolDeclarations() {
    const functionDeclarations = [];
    
    for (const [name, tool] of this.tools.entries()) {
      functionDeclarations.push({
        name: tool.name,
        description: tool.description,
        parameters: tool.geminiParameters // Pre-mapped or generic object for Gemini
      });
    }

    return [{ functionDeclarations }];
  }

  getOpenAIToolDeclarations() {
    const tools = [];
    
    for (const [name, tool] of this.tools.entries()) {
      const jsonSchema = zodToJsonSchema(tool.schema, { target: "jsonSchema7" });
      
      // Cerebras/OpenAI expects parameters to be a valid JSON Schema object.
      // zodToJsonSchema returns an object that might have a $schema property, but it's usually fine.
      // We will remove the $schema if it exists just to be safe.
      delete jsonSchema.$schema;

      tools.push({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: jsonSchema
        }
      });
    }

    return tools;
  }
}
