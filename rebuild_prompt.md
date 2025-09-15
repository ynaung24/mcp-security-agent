## Prompt for build Secure AI Agent Tool

You are tasked with building a web application called **SanitizeAI** from scratch.  
You are an expert full-stack developer specializing in AI-powered web applications using **Next.js (App Router)** and **Genkit**.  
Your code must be **robust, secure, and maintainable**.

---

## 1. Project Goal

SanitizeAI demonstrates how **AI can protect sensitive information in text** by:

1. Accepting free-form text and a sanitization intent (e.g. *“Anonymize PII”*).  
2. Using **Google Gemini 2.5 Pro** to **pick the correct sanitization tool**.  
3. Executing that tool on a **stand-alone MCP server** and streaming progress back to the browser.

The **primary educational goal** is to showcase the **Model Context Protocol (MCP)**:
- A clear separation between the **MCP client** (Genkit flow inside Next.js) and  
- The **MCP server** (a tiny Node/Express service that owns the tools).

---

## 2. Technology Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| AI SDK | Genkit |
| AI Model | Google Gemini 2.5 Pro (`googleai/gemini-2.5-pro`) |
| AI Protocol | **Anthropic Model Context Protocol (MCP)** |
| UI | ShadCN UI |
| Styling | Tailwind CSS |
| Language | TypeScript |
| Forms | `react-hook-form` + `zod` |
| Streaming | `ai/rsc` (React Server Component streaming) |

---

## 3. High-Level Architecture

```
Browser (ShadCN UI)
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

---

## 4. Implementation

### 4.1  MCP Server (`src/mcp/server.ts`)

Install real SDKs:

```bash
npm i @modelcontextprotocol/sdk @modelcontextprotocol/server
```

Code:

```typescript
// src/mcp/server.ts
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/server';
import { ai } from '../lib/ai'; // your Genkit instance
import { definePrompt } from '@genkit-ai/ai';

const PORT = Number(process.env.MCP_PORT ?? 9003);

/* ---------- helper to register one sanitisation tool ---------- */
function addSanitizationTool(
  server: McpServer,
  name: string,
  description: string,
  systemPrompt: string
) {
  server.addTool({
    name,
    description,
    inputSchema: z.object({ text: z.string() }),
    outputSchema: z.object({ sanitizedText: z.string() }),
    execute: async ({ text }) => {
      const prompt = definePrompt(
        {
          name: `${name}Prompt`,
          inputSchema: z.object({ text: z.string() }),
          outputSchema: z.object({ sanitizedText: z.string() }),
          model: 'googleai/gemini-2.5-pro',
        },
        async (input) => ({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input.text },
          ],
        })
      );

      const res = await prompt({ text });
      return { sanitizedText: res.sanitizedText };
    },
  });
}

/* ---------- create MCP server ---------- */
const server = new McpServer(
  { name: 'SanitizeAIServer', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

/* ---------- register concrete tools ---------- */
addSanitizationTool(
  server,
  'anonymize_pii',
  'Anonymises names, emails, phone numbers, addresses, dates of birth, etc.',
  'You are a PII anonymiser.  Return only the anonymised text.'
);

addSanitizationTool(
  server,
  'redact_financial',
  'Redacts IBAN, credit-card numbers, crypto wallets, sort codes, etc.',
  'You are a financial-data redactor.  Return only the redacted text.'
);

/* ---------- expose over plain HTTP ---------- */
const app = express();
app.use(cors({ origin: '*' })); // dev only
app.use(express.json());

app.post('/mcp', (req, res, next) => {
  server
    .handleRequest(req.body, { sessionId: req.ip })
    .then((resp) => res.json(resp))
    .catch(next);
});

createServer(app).listen(PORT, () =>
  console.log(`[MCP] SanitizeAIServer listening on :${PORT}`)
);
```

---

### 4.2  MCP Client / Genkit Flow (`src/ai/flows/sanitize-text-with-mcp.ts`)

```typescript
// src/ai/flows/sanitize-text-with-mcp.ts
import { Client } from '@modelcontextprotocol/sdk';
import { z } from 'zod';
import { ai } from '../../lib/ai';

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

export async function sanitizeTextWithMCP(
  raw: Input,
  onProgress?: (step: string) => void
): Promise<Output> {
  onProgress?.('mcp_connect_start');
  const client = new Client({ name: 'SanitizeAI-Web', version: '1.0.0' });

  const url = `http://localhost:${process.env.MCP_PORT ?? 9003}/mcp`;
  await client.connect({ url, transport: 'http' });
  onProgress?.('mcp_connect_finish');

  onProgress?.('list_tools');
  const toolList = await client.listTools();

  onProgress?.('select_tool');
  const { text: userText, sanitizationRequest } = inputSchema.parse(raw);

  const llmResp = await ai.generate({
    model: 'googleai/gemini-2.5-pro',
    prompt:
      `You are an assistant that picks exactly ONE tool from the list below ` +
      `to satisfy the user's request.\n\n` +
      `User request: "${sanitizationRequest}"\n` +
      `User text (first 200 chars): "${userText.slice(0, 200)}"\n\n` +
      `Available tools:\n` +
      toolList.tools.map((t) => ` - ${t.name}: ${t.description}`).join('\n') +
      `\n\n` +
      `Call the best tool once and return its result.`,
    tools: toolList.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      outputSchema: t.outputSchema,
    })),
    toolChoice: 'required',
  });

  const call = llmResp.toolCalls?.[0];
  if (!call) throw new Error('Model did not call a tool');

  onProgress?.('tool_exec_start');
  const result = await client.callTool({
    name: call.name,
    arguments: call.input,
  });
  onProgress?.('tool_exec_finish');

  return {
    sanitizedText: (result as any).sanitizedText,
    toolUsed: call.name,
  };
}
```

---

### 4.3  Development Runner (`src/ai/dev.ts`)

```typescript
// src/ai/dev.ts
import '../mcp/server'; // starts the HTTP server
console.log('[dev] MCP server spawned');
```

Add to `package.json`:

```json
"scripts": {
  "dev": "next dev",
  "dev:mcp": "tsx watch src/ai/dev.ts",
  "build": "next build",
  "start": "next start"
}
```

Run:

```bash
# terminal 1
npm run dev:mcp

# terminal 2
npm run dev
```

---

### 4.4  Next.js Server Action (`src/app/actions.ts`)

```typescript
// src/app/actions.ts
'use server';

import { sanitizeTextWithMCP } from '@/ai/flows/sanitize-text-with-mcp';
import { createStreamableValue } from 'ai/rsc';

export async function getSanitizedTextStreamAction(data: {
  text: string;
  sanitizationRequest: string;
}) {
  const stream = createStreamableValue<
    { step: string } | { result: { sanitizedText: string; toolUsed: string } },
    never
  >();

  (async () => {
    try {
      const out = await sanitizeTextWithMCP(data, (step) =>
        stream.update({ step })
      );
      stream.done({ result: out });
    } catch (e: any) {
      stream.error(e.message);
    }
  })();

  return stream.value;
}
```

---

### 4.5  User Interface (`src/app/page.tsx`)

The UI is unchanged from the original prompt:

* ShadCN form (`react-hook-form` + `zod`)  
* Dropdown with sample data sets  
* `Progress` component fed by `readStreamableValue`  
* Tabs showing **sanitized text** and **tool used**  
* “View Raw Output” dialog  

(Original code still applies; no MCP-related changes required.)

---

## 5. Environment & Dependencies

```bash
# required extra packages
npm i @modelcontextprotocol/sdk @modelcontextprotocol/server express cors
npm i -D @types/express @types/cors tsx
```

`.env`
```
GEMINI_API_KEY=**************************
MCP_PORT=9003
```

---

## 6. Quick Start

```bash
git clone <repo>
cd SanitizeAI
npm install
echo GEMINI_API_KEY=*** >> .env

# 1. start MCP server
npm run dev:mcp

# 2. (another shell) start Next.js
npm run dev
```

Open http://localhost:3000 – paste sensitive text, choose an intent, watch the AI pick the correct MCP tool and stream the sanitized result back to you.

---
