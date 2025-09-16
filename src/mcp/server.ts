import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { z } from 'zod';
import { Tool, ToolList, McpRequest, McpResponse } from './types';
import { modelManager, ModelProvider } from '../lib/models';

const PORT = Number(process.env.MCP_PORT ?? 9003);

// Custom MCP-like server implementation
class McpLikeServer {
  private tools: Tool[] = [];

  addTool(tool: Tool) {
    this.tools.push(tool);
  }

  async handleRequest(request: McpRequest): Promise<McpResponse> {
    try {
      switch (request.method) {
        case 'tools/list':
          return {
            result: {
              tools: this.tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
                outputSchema: tool.outputSchema,
              }))
            }
          };

        case 'tools/call':
          const { name, arguments: args, provider = 'openai' } = request.params;
          const tool = this.tools.find(t => t.name === name);
          
          if (!tool) {
            return {
              error: {
                code: -32601,
                message: `Tool '${name}' not found`
              }
            };
          }

          // Execute the tool with the specified provider
          const result = await this.executeTool(tool, args, provider);
          return { result };

        default:
          return {
            error: {
              code: -32601,
              message: `Method '${request.method}' not found`
            }
          };
      }
    } catch (error: any) {
      return {
        error: {
          code: -32603,
          message: error.message || 'Internal error'
        }
      };
    }
  }

  private async executeTool(tool: Tool, args: any, provider: ModelProvider = 'openai') {
    // For our sanitization tools, we'll use the model manager
    const systemPrompts: Record<string, string> = {
      'anonymize_pii': 'You are a PII anonymiser. Replace all personally identifiable information with appropriate placeholders while maintaining the structure and readability of the text. Return only the anonymised text.',
      'redact_financial': 'You are a financial-data redactor. Replace all financial information like bank account numbers, credit card numbers, IBANs, crypto wallet addresses, and sort codes with appropriate placeholders while maintaining the structure and readability of the text. Return only the redacted text.',
      'redact_medical': 'You are a medical data redactor. Replace all medical information like patient IDs, medical record numbers, diagnoses, medications, and other sensitive health information with appropriate placeholders while maintaining the structure and readability of the text. Return only the redacted text.',
      'general_sanitize': 'You are a general data sanitizer. Replace any sensitive or confidential information with appropriate placeholders while maintaining the structure and readability of the text. This includes but is not limited to names, addresses, phone numbers, emails, IDs, and other personally identifiable information. Return only the sanitized text.'
    };

    const systemPrompt = systemPrompts[tool.name] || systemPrompts['general_sanitize'];
    
    const sanitizedText = await modelManager.generateText(
      provider,
      [{ role: 'user', content: args.text }],
      systemPrompt
    );

    return { sanitizedText };
  }
}

// Create server instance
const server = new McpLikeServer();

// Register sanitization tools
server.addTool({
  name: 'anonymize_pii',
  description: 'Anonymises names, emails, phone numbers, addresses, dates of birth, etc.',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ sanitizedText: z.string() }),
});

server.addTool({
  name: 'redact_financial',
  description: 'Redacts IBAN, credit-card numbers, crypto wallets, sort codes, etc.',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ sanitizedText: z.string() }),
});

server.addTool({
  name: 'redact_medical',
  description: 'Redacts medical record numbers, patient IDs, diagnoses, medications, etc.',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ sanitizedText: z.string() }),
});

server.addTool({
  name: 'general_sanitize',
  description: 'General sanitization for any sensitive information',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ sanitizedText: z.string() }),
});

// Expose over HTTP
const app = express();
app.use(cors({ origin: '*' })); // dev only
app.use(express.json());

app.post('/mcp', async (req, res) => {
  try {
    const response = await server.handleRequest(req.body);
    res.json(response);
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: -32603,
        message: error.message || 'Internal error'
      }
    });
  }
});

createServer(app).listen(PORT, () =>
  console.log(`[MCP] SanitizeAIServer listening on :${PORT}`)
);