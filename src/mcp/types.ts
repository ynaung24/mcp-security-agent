import { z } from 'zod';

// MCP-like types for our custom implementation
export interface Tool {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
}

export interface ToolCall {
  name: string;
  arguments: any;
}

export interface ToolResult {
  sanitizedText: string;
}

export interface ToolList {
  tools: Tool[];
}

export interface McpRequest {
  method: string;
  params?: any;
}

export interface McpResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}
