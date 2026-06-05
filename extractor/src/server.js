'use strict';

const express = require('express');
const { extract } = require('./extract');

const app = express();
app.use(express.json({ limit: '10mb' }));

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Main extraction endpoint ────────────────────────────────────────────────
app.post('/extract', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate URL
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'URL must use http or https' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  console.log(`[extract] Starting extraction for: ${url}`);
  const startTime = Date.now();

  try {
    const result = await extract(url, (msg) => {
      console.log(`[extract] ${msg}`);
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[extract] Done in ${duration}s — ${result.screenshots.length} screenshots, ${result.hoverCaptures.length} hover captures`);

    res.json(result);
  } catch (error) {
    console.error(`[extract] Error: ${error.message}`);

    const statusCode =
      error.message.includes('timeout') ? 504
      : error.message.includes('net::') ? 502
      : 500;

    res.status(statusCode).json({
      error: error.message,
      url,
    });
  }
});

// ─── Start server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Design DNA Extractor running on port ${PORT}`);
});
