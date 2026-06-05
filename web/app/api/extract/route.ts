import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, buildClaudeMessages } from '@/lib/prompt';
import type { ExtractionData } from '@/lib/types';

export const maxDuration = 300; // 5 minutes — Playwright can be slow

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ─── Send SSE event helper ────────────────────────────────────────────────────

function sseEvent(controller: ReadableStreamDefaultController, data: object) {
  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

// ─── Main API route ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'URL required' }, { status: 400 });
  }

  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith('http')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ── Stage 1: Scraping ──────────────────────────────────────────────
        sseEvent(controller, {
          type: 'stage',
          stage: 'scraping',
          message: `Launching headless browser for ${new URL(normalizedUrl).hostname}...`,
        });

        const extractorUrl = process.env.EXTRACTOR_URL;
        if (!extractorUrl) throw new Error('EXTRACTOR_URL environment variable not set');

        const extractResponse = await fetch(`${extractorUrl}/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: normalizedUrl }),
          signal: AbortSignal.timeout(240_000), // 4 min timeout for Playwright
        });

        if (!extractResponse.ok) {
          const err = await extractResponse.json().catch(() => ({ error: 'Extraction failed' }));
          throw new Error(err.error || `Extractor returned ${extractResponse.status}`);
        }

        const extractionData: ExtractionData = await extractResponse.json();

        sseEvent(controller, {
          type: 'stage',
          stage: 'analyzing',
          message: `Scraped ${extractionData.screenshots.length} frames, ${Object.keys(extractionData.cssData.customProperties).length} CSS tokens, ${extractionData.hoverCaptures.length} hover states. Sending to Claude...`,
        });

        // ── Stage 2: Claude Analysis + Streaming ──────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages = buildClaudeMessages(extractionData) as any;

        sseEvent(controller, {
          type: 'stage',
          stage: 'writing',
          message: 'Claude is writing your Design DNA...',
        });

        // Stream Claude's response
        const claudeStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          messages,
        });

        let fullOutput = '';

        for await (const event of claudeStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const text = event.delta.text;
            fullOutput += text;
            sseEvent(controller, { type: 'text', text });
          }
        }

        // Extract site name from the output for the filename
        const siteNameMatch = fullOutput.match(/# DESIGN DNA — (.+)/);
        const siteName = siteNameMatch
          ? siteNameMatch[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
          : new URL(normalizedUrl).hostname.replace('www.', '');

        sseEvent(controller, { type: 'done', siteName });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[extract route]', message);
        sseEvent(controller, { type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}
