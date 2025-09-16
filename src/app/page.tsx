'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { readStreamableValue } from 'ai/rsc';
import { getSanitizedTextStreamAction } from './actions';

const formSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  sanitizationRequest: z.string().min(1, 'Sanitization request is required'),
  modelProvider: z.enum(['openai', 'gemini']).default('openai'),
});

type FormData = z.infer<typeof formSchema>;

const sampleData = [
  {
    name: 'PII Data',
    text: 'John Smith, email: john.smith@example.com, phone: (555) 123-4567, lives at 123 Main St, New York, NY 10001. Born on 1985-03-15.',
    request: 'Anonymize PII'
  },
  {
    name: 'Financial Data',
    text: 'Account holder: Jane Doe, IBAN: GB29 NWBK 6016 1331 9268 19, Credit Card: 4532-1234-5678-9012, Sort Code: 20-00-00',
    request: 'Redact financial information'
  },
  {
    name: 'Medical Data',
    text: 'Patient ID: MED-12345, Patient: Robert Johnson, DOB: 1978-12-03, Diagnosis: Hypertension, Medication: Lisinopril 10mg daily',
    request: 'Redact medical information'
  }
];

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [result, setResult] = useState<{ sanitizedText: string; toolUsed: string; modelUsed: string } | null>(null);
  const [rawOutput, setRawOutput] = useState<any>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormData) => {
    setIsProcessing(true);
    setProgress('');
    setResult(null);
    setRawOutput(null);

    try {
      const stream = await getSanitizedTextStreamAction(data);
      
      for await (const chunk of readStreamableValue(stream)) {
        if (chunk && 'step' in chunk) {
          setProgress(chunk.step);
        } else if (chunk && 'result' in chunk) {
          setResult(chunk.result);
          setRawOutput(chunk);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setProgress('Error occurred during processing');
    } finally {
      setIsProcessing(false);
    }
  };

  const loadSampleData = (sample: typeof sampleData[0]) => {
    setValue('text', sample.text);
    setValue('sanitizationRequest', sample.request);
  };

  const progressMessages: Record<string, string> = {
    'mcp_connect_start': 'Connecting to MCP server...',
    'mcp_connect_finish': 'Connected to MCP server',
    'list_tools': 'Listing available tools...',
    'select_tool': 'Selecting appropriate tool...',
    'tool_exec_start': 'Executing sanitization tool...',
    'tool_exec_finish': 'Sanitization complete!',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">SanitizeAI</h1>
          <p className="text-lg text-gray-600">
            AI-powered data sanitization using Model Context Protocol (MCP)
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sample Data Sets
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {sampleData.map((sample, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => loadSampleData(sample)}
                    className="p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div className="font-medium text-sm">{sample.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {sample.text.substring(0, 50)}...
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="text" className="block text-sm font-medium text-gray-700 mb-2">
                Text to Sanitize
              </label>
              <textarea
                {...register('text')}
                id="text"
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter the text you want to sanitize..."
              />
              {errors.text && (
                <p className="mt-1 text-sm text-red-600">{errors.text.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="sanitizationRequest" className="block text-sm font-medium text-gray-700 mb-2">
                Sanitization Request
              </label>
              <input
                {...register('sanitizationRequest')}
                id="sanitizationRequest"
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 'Anonymize PII', 'Redact financial data', etc."
              />
              {errors.sanitizationRequest && (
                <p className="mt-1 text-sm text-red-600">{errors.sanitizationRequest.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="modelProvider" className="block text-sm font-medium text-gray-700 mb-2">
                AI Model Provider
              </label>
              <select
                {...register('modelProvider')}
                id="modelProvider"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="openai">OpenAI GPT-3.5-turbo</option>
                <option value="gemini">Google Gemini 1.5 Flash</option>
              </select>
              {errors.modelProvider && (
                <p className="mt-1 text-sm text-red-600">{errors.modelProvider.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? 'Processing...' : 'Sanitize Text'}
            </button>
          </form>
        </div>

        {progress && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Progress</h3>
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="text-gray-700">{progressMessages[progress] || progress}</span>
            </div>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Results</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Tool Used:</h4>
                <div className="bg-gray-100 px-3 py-2 rounded-md">
                  <code className="text-sm">{result.toolUsed}</code>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-2">Model Used:</h4>
                <div className="bg-gray-100 px-3 py-2 rounded-md">
                  <code className="text-sm">{result.modelUsed}</code>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-2">Sanitized Text:</h4>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800">
                    {result.sanitizedText}
                  </pre>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => setRawOutput(rawOutput ? null : result)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {rawOutput ? 'Hide' : 'View'} Raw Output
                </button>
                
                {rawOutput && (
                  <div className="mt-3 bg-gray-900 text-green-400 p-4 rounded-md overflow-x-auto">
                    <pre className="text-xs">
                      {JSON.stringify(rawOutput, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
