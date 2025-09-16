# SanitizeAI - AI-Powered Data Sanitization

SanitizeAI demonstrates how **AI can protect sensitive information in text** using a **custom MCP-like architecture**. The system supports both **OpenAI GPT-3.5-turbo** and **Google Gemini 1.5 Flash** to intelligently select and execute appropriate sanitization tools, with a clean separation between the AI client and tool server.

## Features

- **AI-Powered Tool Selection**: Uses OpenAI GPT-3.5-turbo or Google Gemini 1.5 Flash to automatically choose the right sanitization tool based on user intent
- **MCP-like Architecture**: Clean separation between MCP client (Next.js) and MCP server (standalone Express service)
- **Multiple Sanitization Tools**:
  - PII Anonymization (names, emails, phone numbers, addresses, etc.)
  - Financial Data Redaction (IBAN, credit cards, crypto wallets, etc.)
  - Medical Data Redaction (patient IDs, diagnoses, medications, etc.)
  - General Sanitization (any sensitive information)
- **Real-time Streaming**: Progress updates and results streamed to the browser
- **Modern UI**: Built with Next.js 14, Tailwind CSS, and React Hook Form

## Architecture

```
Browser (Next.js UI)
        │
        ▼
Next.js Server Action  ←  streams progress + result
        │
        ▼
Genkit Flow (MCP CLIENT)  –  no tools here!
        │
        ▼
MCP Server (standalone HTTP service)  –  owns tools
```

## Technology Stack

- **Framework**: Next.js 14 (App Router)
- **AI SDK**: OpenAI SDK (direct integration)
- **AI Models**: OpenAI GPT-3.5-turbo or Google Gemini 1.5 Flash (user selectable)
- **AI Protocol**: Custom MCP-like implementation
- **UI**: Tailwind CSS + React Hook Form
- **Language**: TypeScript
- **Streaming**: `ai/rsc` (React Server Component streaming)

## Quick Start

1. **Clone and Install**:
   ```bash
   cd mcp-security-agent
   npm install
   ```

2. **Set up Environment**:
   ```bash
   cp env.example .env
   # Edit .env and add your OpenAI API key
   ```

3. **Start the MCP Server** (Terminal 1):
   ```bash
   npm run dev:mcp
   ```

4. **Start the Next.js App** (Terminal 2):
   ```bash
   npm run dev
   ```

5. **Open the Application**:
   Visit http://localhost:3000

## Environment Variables

Create a `.env` file with:

```env
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
MCP_PORT=9003
```

## Cost Information

This system supports both **OpenAI GPT-3.5-turbo** and **Google Gemini 1.5 Pro** for cost-effective AI processing:

### OpenAI GPT-3.5-turbo:
- **Input**: $0.50 per 1M tokens
- **Output**: $1.50 per 1M tokens
- **Typical cost per request**: ~$0.0003-0.001

### Google Gemini 1.5 Flash:
- **Input**: $0.075 per 1M tokens
- **Output**: $0.30 per 1M tokens
- **Typical cost per request**: ~$0.0001-0.0005

### Usage Estimates:
- **100 requests/day**: ~$0.50-2 per month
- **1000 requests/day**: ~$5-20 per month

The system makes 2 API calls per sanitization request (tool selection + sanitization), making it very cost-effective for most use cases. **Gemini 1.5 Flash is actually cheaper than OpenAI** and faster, making it an excellent choice for high-volume usage.

## Usage

1. **Load Sample Data**: Click on one of the sample data sets to quickly test the system
2. **Enter Text**: Paste or type the text you want to sanitize
3. **Specify Intent**: Describe what type of sanitization you want (e.g., "Anonymize PII", "Redact financial data")
4. **Choose Model**: Select between OpenAI GPT-3.5-turbo or Google Gemini 1.5 Flash
5. **Process**: Click "Sanitize Text" and watch the AI select the appropriate tool and process your data
6. **View Results**: See the sanitized text, which tool was used, which model was used, and optionally view the raw output

## Available Sanitization Tools

- **anonymize_pii**: Anonymizes names, emails, phone numbers, addresses, dates of birth, etc.
- **redact_financial**: Redacts IBAN, credit-card numbers, crypto wallets, sort codes, etc.
- **redact_medical**: Redacts medical record numbers, patient IDs, diagnoses, medications, etc.
- **general_sanitize**: General sanitization for any sensitive information

## Development

### Project Structure

```
src/
├── ai/
│   ├── flows/
│   │   └── sanitize-text-with-mcp.ts  # MCP client flow
│   └── dev.ts                         # MCP server runner
├── app/
│   ├── actions.ts                     # Next.js server actions
│   ├── page.tsx                       # Main UI component
│   ├── layout.tsx                     # App layout
│   └── globals.css                    # Global styles
├── mcp/
│   ├── server.ts                      # MCP server with tools
│   ├── client.ts                      # MCP client implementation
│   └── types.ts                       # MCP type definitions
└── components/                        # Reusable UI components
```

### Scripts

- `npm run dev` - Start Next.js development server
- `npm run dev:mcp` - Start MCP server in development mode
- `npm run build` - Build for production
- `npm run start` - Start production server

## How It Works

1. **User Input**: User provides text and sanitization intent
2. **MCP Connection**: Next.js server action connects to the MCP server
3. **Tool Discovery**: MCP client lists available sanitization tools
4. **AI Tool Selection**: Selected AI model (OpenAI or Gemini) analyzes the request and selects the best tool
5. **Tool Execution**: Selected tool is executed on the MCP server
6. **Result Streaming**: Sanitized text and metadata are streamed back to the browser

## Security Considerations

- **API Key Protection**: Never commit your `.env` file to version control
- **Local Development**: The MCP server runs on localhost by default
- **CORS Configuration**: Currently enabled for development (restrict in production)
- **Server-Side Processing**: All AI processing happens server-side
- **No Data Storage**: No sensitive data is stored or logged
- **Environment Variables**: All sensitive configuration uses environment variables

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
