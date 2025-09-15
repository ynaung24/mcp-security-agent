import { z } from 'zod';
import OpenAI from 'openai';
import { McpLikeClient } from '../../mcp/client';

const inputSchema = z.object({
  text: z.string(),
  sanitizationRequest: z.string(), // free-form user intent
});
type Input = z.infer<typeof inputSchema>;

const outputSchema = z.object({
  sanitizedText: z.string(),
  toolUsed: z.string(),
});
type Output = z.infer<typeof outputSchema>;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function sanitizeTextWithMCP(
  raw: Input,
  onProgress?: (step: string) => void
): Promise<Output> {
  onProgress?.('mcp_connect_start');
  const client = new McpLikeClient(`http://localhost:${process.env.MCP_PORT ?? 9003}`);
  await client.connect();
  onProgress?.('mcp_connect_finish');

  onProgress?.('list_tools');
  const toolList = await client.listTools();

  onProgress?.('select_tool');
  const { text: userText, sanitizationRequest } = inputSchema.parse(raw);

  // Create tool definitions for OpenAI
  const tools = toolList.tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text to sanitize'
          }
        },
        required: ['text']
      },
    },
  }));

  const llmResp = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: `You are an assistant that picks exactly ONE tool from the list below to satisfy the user's request.`,
      },
      {
        role: 'user',
        content: `User request: "${sanitizationRequest}"\nUser text (first 200 chars): "${userText.slice(0, 200)}"\n\nAvailable tools:\n${toolList.tools.map((t) => ` - ${t.name}: ${t.description}`).join('\n')}\n\nCall the best tool once and return its result.`,
      },
    ],
    tools,
    tool_choice: 'required',
    temperature: 0.1,
  });

  const call = llmResp.choices[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error('Model did not call a tool');

  onProgress?.('tool_exec_start');
  const result = await client.callTool({
    name: call.function.name,
    arguments: JSON.parse(call.function.arguments),
  });
  onProgress?.('tool_exec_finish');

  return {
    sanitizedText: (result as any).sanitizedText,
    toolUsed: call.function.name,
  };
}
