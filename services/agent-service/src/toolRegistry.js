import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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
      // Create OpenAPI-like schema for Gemini based on Zod schema.
      // Since Gemini SDK uses specific formatting, we map our simplified definitions.
      // We'll rely on the tool providing a Gemini-compatible `parameters` object alongside the zod schema.
      functionDeclarations.push({
        name: tool.name,
        description: tool.description,
        parameters: tool.geminiParameters // Pre-mapped or generic object for Gemini
      });
    }

    return [{ functionDeclarations }];
  }
}
