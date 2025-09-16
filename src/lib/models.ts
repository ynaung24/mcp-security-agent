import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type ModelProvider = 'openai' | 'gemini';

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  apiKey: string;
}

export class ModelManager {
  private openai: OpenAI | null = null;
  private gemini: GoogleGenerativeAI | null = null;

  constructor() {
    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    // Initialize Gemini if API key is available
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
  }

  getAvailableProviders(): ModelProvider[] {
    const providers: ModelProvider[] = [];
    if (this.openai) providers.push('openai');
    if (this.gemini) providers.push('gemini');
    return providers;
  }

  getDefaultProvider(): ModelProvider {
    const available = this.getAvailableProviders();
    return available[0] || 'openai';
  }

  getModelConfig(provider: ModelProvider): ModelConfig {
    switch (provider) {
      case 'openai':
        if (!this.openai) throw new Error('OpenAI not configured');
        return {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: process.env.OPENAI_API_KEY!,
        };
      case 'gemini':
        if (!this.gemini) throw new Error('Gemini not configured');
        return {
          provider: 'gemini',
          model: 'gemini-1.5-flash',
          apiKey: process.env.GEMINI_API_KEY!,
        };
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async generateText(
    provider: ModelProvider,
    messages: Array<{ role: string; content: string }>,
    systemPrompt?: string
  ): Promise<string> {
    const fullMessages = systemPrompt 
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    switch (provider) {
      case 'openai':
        if (!this.openai) throw new Error('OpenAI not configured');
        const openaiResponse = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: fullMessages as any,
          temperature: 0.1,
        });
        return openaiResponse.choices[0]?.message?.content || '';

      case 'gemini':
        if (!this.gemini) throw new Error('Gemini not configured');
        const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        // Convert messages to Gemini format
        const geminiPrompt = fullMessages
          .map(msg => `${msg.role === 'system' ? 'System' : 'User'}: ${msg.content}`)
          .join('\n\n');
        
        const geminiResponse = await model.generateContent(geminiPrompt);
        return geminiResponse.response.text();

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async generateWithTools(
    provider: ModelProvider,
    messages: Array<{ role: string; content: string }>,
    tools: any[],
    toolChoice: string = 'required'
  ): Promise<any> {
    switch (provider) {
      case 'openai':
        if (!this.openai) throw new Error('OpenAI not configured');
        return await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: messages as any,
          tools,
          tool_choice: toolChoice,
          temperature: 0.1,
        });

      case 'gemini':
        // Gemini doesn't support function calling in the same way
        // We'll use a different approach for Gemini
        if (!this.gemini) throw new Error('Gemini not configured');
        const model = this.gemini.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        // Create a prompt that includes tool descriptions
        const toolDescriptions = tools.map(tool => 
          `- ${tool.function.name}: ${tool.function.description}`
        ).join('\n');
        
        const userMessage = messages.find(m => m.role === 'user')?.content || '';
        const systemMessage = messages.find(m => m.role === 'system')?.content || '';
        
        const prompt = `${systemMessage}\n\n${userMessage}\n\nAvailable tools:\n${toolDescriptions}\n\nPlease respond with ONLY the tool name and parameters in this exact JSON format: {"tool": "tool_name", "arguments": {"text": "user_text"}}`;
        
        const response = await model.generateContent(prompt);
        const text = response.response.text();
        
        // Parse the response to extract tool call information
        try {
          // Look for JSON in the response (handle markdown code blocks)
          let jsonMatch = text.match(/```json\s*(\{.*?\})\s*```/s);
          if (!jsonMatch) {
            // Fallback: look for plain JSON - find complete JSON object
            const jsonStart = text.indexOf('{');
            if (jsonStart !== -1) {
              let braceCount = 0;
              let jsonEnd = jsonStart;
              for (let i = jsonStart; i < text.length; i++) {
                if (text[i] === '{') braceCount++;
                if (text[i] === '}') braceCount--;
                if (braceCount === 0) {
                  jsonEnd = i;
                  break;
                }
              }
              if (braceCount === 0) {
                jsonMatch = [text.substring(jsonStart, jsonEnd + 1)];
              }
            }
          }
          
          if (jsonMatch) {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            const parsed = JSON.parse(jsonStr);
            return {
              choices: [{
                message: {
                  tool_calls: [{
                    function: {
                      name: parsed.tool,
                      arguments: JSON.stringify(parsed.arguments || {})
                    }
                  }]
                }
              }]
            };
          }
          
          // Fallback: try to extract tool name from text
          const toolMatch = text.match(/(anonymize_pii|redact_financial|redact_medical|general_sanitize)/);
          if (toolMatch) {
            return {
              choices: [{
                message: {
                  tool_calls: [{
                    function: {
                      name: toolMatch[1],
                      arguments: JSON.stringify({ text: userMessage })
                    }
                  }]
                }
              }]
            };
          }
        } catch (e) {
          console.error('Gemini response parsing error:', e);
          console.error('Gemini response text:', text);
        }
        
        throw new Error(`Failed to parse Gemini response: ${text}`);

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
}

export const modelManager = new ModelManager();
