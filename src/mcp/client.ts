import { ToolList, ToolCall, ToolResult, McpRequest } from './types';
import { ModelProvider } from '../lib/models';

// Custom MCP-like client implementation
export class McpLikeClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async connect(): Promise<void> {
    // Connection is implicit in our HTTP-based implementation
    console.log(`[MCP Client] Connected to ${this.baseUrl}`);
  }

  async listTools(): Promise<ToolList> {
    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'tools/list',
        params: {}
      } as McpRequest)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.result;
  }

  async callTool(toolCall: ToolCall, provider: ModelProvider = 'openai'): Promise<ToolResult> {
    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'tools/call',
        params: {
          name: toolCall.name,
          arguments: toolCall.arguments,
          provider: provider
        }
      } as McpRequest)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.result;
  }
}
