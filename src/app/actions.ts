'use server';

import { sanitizeTextWithMCP } from '@/ai/flows/sanitize-text-with-mcp';
import { createStreamableValue } from 'ai/rsc';

export async function getSanitizedTextStreamAction(data: {
  text: string;
  sanitizationRequest: string;
  modelProvider?: 'openai' | 'gemini';
}) {
  const stream = createStreamableValue<
    { step: string } | { result: { sanitizedText: string; toolUsed: string; modelUsed: string } },
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
