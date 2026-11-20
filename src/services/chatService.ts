import type { ChatAttachment, WorkflowCardData } from '../types';
import { getApiBaseUrl } from './apiClient';

export interface StreamChatParams {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  attachments?: ChatAttachment[];
  signal?: AbortSignal;
  onToken: (text: string) => void;
  onWorkflow: (card: WorkflowCardData) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

export async function streamChatMessage({
  messages,
  attachments,
  signal,
  onToken,
  onWorkflow,
  onDone,
  onError,
}: StreamChatParams): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      attachments: attachments?.map((a) => ({ name: a.name, previewText: a.previewText })),
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const fallbackText = await response.text().catch(() => 'Unable to reach AI chat service.');
    onError(fallbackText || `Server error (${response.status})`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const lines = frame.split('\n');
        let eventName = 'message';
        let dataLine = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLine += line.slice(5).trim();
          }
        }

        if (!dataLine) continue;

        try {
          const parsed = JSON.parse(dataLine);
          if (eventName === 'token' && typeof parsed.text === 'string') {
            onToken(parsed.text);
          } else if (eventName === 'workflow') {
            onWorkflow(parsed as WorkflowCardData);
          } else if (eventName === 'error') {
            onError(parsed.message || 'Streaming error occurred.');
            return;
          } else if (eventName === 'done') {
            onDone();
            return;
          }
        } catch {
          // Ignore malformed partial SSE frames
        }
      }
    }
    onDone();
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      onDone();
      return;
    }
    onError(err instanceof Error ? err.message : 'Stream interrupted unexpectedly.');
  } finally {
    reader.releaseLock();
  }
}

export interface AutoBookDownloadItem {
  id: string;
  label: string;
  artifactType: 'interior_pdf' | 'full_cover_pdf' | 'metadata_json' | 'book_preview' | 'complete_zip';
  format:
    | 'Interior PDF'
    | 'Full Cover PDF'
    | 'Metadata JSON'
    | 'Book Preview'
    | 'Complete ZIP Package';
  fileName: string;
  fileSize: string;
  url: string;
  primary?: boolean;
}

export interface AutoBookResponse {
  book: {
    title: string;
    subtitle: string;
    category:
      | "Children's Books"
      | 'Coloring Books'
      | 'Activity Books'
      | 'Puzzle Books'
      | 'Journals'
      | 'Non-Fiction Guides'
      | 'Workbooks';
    targetAudience: string;
    trimSize: '6x9' | '8.5x11' | '8.5x8.5' | '5.5x8.5' | '7x10';
    pageCount: number;
    paperType: 'White Paper' | 'Cream Paper';
    interiorType: 'Black & White' | 'Standard Color' | 'Premium Color';
    bleed: boolean;
    author: string;
  };
  research: {
    summary: string;
    marketGap: string;
    opportunityScore: number;
    keywords: string[];
    bisacCategories: string[];
    backCoverBlurb: string;
    sources: Array<{ title: string; url: string; domain: string }>;
  };
  pages: Array<{
    label: string;
    heading: string;
    body: string;
    callout?: string;
  }>;
  coverSpec: {
    fullWidthIn: number;
    fullHeightIn: number;
    spineWidthIn: number;
    bleedIn: number;
    fullWidthPx300: number;
    fullHeightPx300: number;
    spineTextAllowed: boolean;
  };
  downloads: AutoBookDownloadItem[];
}

export async function runAutoBookPipeline(payload: {
  topic: string;
  category?: string;
  targetAudience?: string;
  trimSize?: string;
  pageCount?: number;
  author?: string;
}): Promise<AutoBookResponse> {
  const response = await fetch(`${getApiBaseUrl()}/chat/auto-book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: 'Failed to generate book.' }));
    throw new Error(errBody.error || `Server error (${response.status})`);
  }

  const data = (await response.json()) as AutoBookResponse;
  const baseOrigin = getApiBaseUrl().replace(/\/api$/, '');
  return {
    ...data,
    downloads: data.downloads.map((item) => ({
      ...item,
      url: item.url.startsWith('http') ? item.url : `${baseOrigin}${item.url}`,
    })),
  };
}

