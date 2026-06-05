'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 'idle' | 'scraping' | 'analyzing' | 'writing' | 'done' | 'error';

interface HistoryItem {
  url: string;
  siteName: string;
  content: string;
  extractedAt: string;
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGES = {
  idle:      { label: '',                       color: '' },
  scraping:  { label: 'Scraping design...',     color: '#f0a500' },
  analyzing: { label: 'Analyzing...',           color: '#f0a500' },
  writing:   { label: 'Writing Design DNA...',  color: '#5e6ad2' },
  done:      { label: 'Done',                   color: '#3dd68c' },
  error:     { label: 'Error',                  color: '#e54d4d' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [stageMessage, setStageMessage] = useState('');
  const [output, setOutput] = useState('');
  const [siteName, setSiteName] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistory, setActiveHistory] = useState<HistoryItem | null>(null);

  const outputRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll output as it streams
  useEffect(() => {
    if (stage === 'writing' && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, stage]);

  // ── Extract handler ──────────────────────────────────────────────────────

  const handleExtract = useCallback(async () => {
    if (!url.trim() || stage !== 'idle') return;

    abortRef.current = new AbortController();
    setStage('scraping');
    setOutput('');
    setError('');
    setSiteName('');
    setActiveHistory(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'stage') {
              setStage(event.stage === 'analyzing' ? 'analyzing' : event.stage === 'writing' ? 'writing' : 'scraping');
              setStageMessage(event.message);
            } else if (event.type === 'text') {
              accumulated += event.text;
              setOutput(accumulated);
            } else if (event.type === 'done') {
              const name = event.siteName || 'site';
              setSiteName(name);
              setStage('done');

              // Save to history
              const item: HistoryItem = {
                url: url.trim(),
                siteName: name,
                content: accumulated,
                extractedAt: new Date().toISOString(),
              };
              setHistory(prev => [item, ...prev.slice(0, 4)]); // keep last 5
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStage('idle');
        return;
      }
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStage('error');
    }
  }, [url, stage]);

  // ── Download handler ─────────────────────────────────────────────────────

  const handleDownload = useCallback((content: string, name: string) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `design-dna-${name}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(href);
  }, []);

  const handleCancel = () => {
    abortRef.current?.abort();
    setStage('idle');
    setOutput('');
    setStageMessage('');
  };

  const handleReset = () => {
    setStage('idle');
    setOutput('');
    setError('');
    setStageMessage('');
    setSiteName('');
    setActiveHistory(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const displayContent = activeHistory?.content ?? output;
  const displayName = activeHistory?.siteName ?? siteName;
  const isProcessing = stage === 'scraping' || stage === 'analyzing' || stage === 'writing';

  // ── Key handler ──────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) handleExtract();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#e8e8f0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── Header ── */}
      <header style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 32px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        background: 'rgba(10,10,15,0.9)',
        backdropFilter: 'blur(12px)',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#5e6ad2', boxShadow: '0 0 8px rgba(94,106,210,0.6)',
          }} />
          <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>Design DNA</span>
          <span style={{ fontSize: 11, color: '#4a4a6a', fontFamily: 'monospace', marginLeft: 4 }}>v1.0</span>
        </div>

        {/* History tabs */}
        {history.length > 0 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#4a4a6a', marginRight: 4 }}>HISTORY</span>
            {history.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  if (stage === 'idle' || stage === 'done' || stage === 'error') {
                    setActiveHistory(item);
                    setStage('done');
                  }
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: `1px solid ${activeHistory?.siteName === item.siteName ? 'rgba(94,106,210,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  background: activeHistory?.siteName === item.siteName ? 'rgba(94,106,210,0.1)' : 'transparent',
                  color: activeHistory?.siteName === item.siteName ? '#8b97f0' : '#6e6e8a',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  transition: 'all 0.15s ease',
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.siteName}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── Main content ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 32px 32px' }}>

        {/* ── Hero / Input area ── */}
        <div style={{
          maxWidth: 640,
          margin: stage === 'idle' ? '120px auto 0' : '40px auto 0',
          width: '100%',
          transition: 'margin 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {stage === 'idle' && (
            <>
              <h1 style={{
                fontSize: 40,
                fontWeight: 700,
                letterSpacing: '-0.04em',
                marginBottom: 8,
                background: 'linear-gradient(135deg, #f0f0f5 30%, #6e7abb)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Extract any design.
              </h1>
              <p style={{ color: '#6e6e8a', fontSize: 16, marginBottom: 40, lineHeight: 1.5 }}>
                Drop a URL. Get a complete Design DNA file — colors, motion, typography,
                every component. Use it to guide Claude when building your next site.
              </p>
            </>
          )}

          {/* URL Input */}
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://linear.app"
              disabled={isProcessing}
              autoFocus
              style={{
                width: '100%',
                height: 52,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: '0 140px 0 18px',
                fontSize: 15,
                color: '#f0f0f5',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(94,106,210,0.5)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />

            <button
              onClick={handleExtract}
              disabled={!url.trim() || isProcessing}
              style={{
                position: 'absolute',
                right: 6,
                top: 6,
                height: 40,
                padding: '0 18px',
                background: url.trim() && !isProcessing ? '#5e6ad2' : 'rgba(255,255,255,0.06)',
                border: 'none',
                borderRadius: 8,
                color: url.trim() && !isProcessing ? '#fff' : '#4a4a6a',
                fontSize: 13,
                fontWeight: 600,
                cursor: url.trim() && !isProcessing ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              Extract →
            </button>
          </div>

          {/* Stage indicator */}
          {(isProcessing || stage === 'error') && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              {isProcessing && (
                <div style={{
                  width: 14,
                  height: 14,
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderTopColor: STAGES[stage].color,
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  flexShrink: 0,
                }} />
              )}
              <span style={{
                fontSize: 13,
                color: STAGES[stage].color || '#6e6e8a',
                fontFamily: 'monospace',
              }}>
                {stage === 'error' ? `✗ ${error}` : stageMessage || STAGES[stage].label}
              </span>
              {isProcessing && (
                <button
                  onClick={handleCancel}
                  style={{
                    marginLeft: 'auto',
                    padding: '2px 10px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 4,
                    color: '#6e6e8a',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {/* Writing progress */}
          {stage === 'writing' && output && (
            <div style={{ marginTop: 8 }}>
              <div style={{
                height: 2,
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 1,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #5e6ad2, #8b97f0)',
                  animation: 'progress-shimmer 1.5s ease-in-out infinite',
                  backgroundSize: '200% 100%',
                }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Output display ── */}
        {(stage === 'writing' || stage === 'done') && displayContent && (
          <div style={{
            maxWidth: 900,
            margin: '24px auto 0',
            width: '100%',
            animation: 'fadeIn 0.3s ease',
          }}>
            {/* Output toolbar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
              padding: '0 4px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: '#4a4a6a',
                }}>
                  design-dna-{displayName || 'site'}.md
                </span>
                {stage === 'done' && (
                  <span style={{
                    fontSize: 10,
                    background: 'rgba(61,214,140,0.12)',
                    color: '#3dd68c',
                    border: '1px solid rgba(61,214,140,0.2)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontFamily: 'monospace',
                  }}>
                    COMPLETE ✓
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                {stage === 'done' && (
                  <>
                    <button
                      onClick={() => navigator.clipboard.writeText(displayContent)}
                      style={actionBtnStyle}
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => handleDownload(displayContent, displayName)}
                      style={{ ...actionBtnStyle, background: 'rgba(94,106,210,0.15)', borderColor: 'rgba(94,106,210,0.3)', color: '#8b97f0' }}
                    >
                      ↓ Download .md
                    </button>
                    <button onClick={handleReset} style={actionBtnStyle}>
                      ↺ New
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* The output */}
            <div style={{
              background: '#0d0d14',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              {/* Fake titlebar */}
              <div style={{
                padding: '10px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                {['#ff5f57', '#ffbd2e', '#28c840'].map(c => (
                  <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.7 }} />
                ))}
              </div>

              {/* Markdown content */}
              <pre
                ref={outputRef}
                style={{
                  margin: 0,
                  padding: '20px 24px',
                  fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
                  fontSize: 12.5,
                  lineHeight: 1.75,
                  color: '#c8c8e0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '70vh',
                  overflowY: 'auto',
                  scrollBehavior: 'smooth',
                }}
              >
                <OutputWithHighlighting content={displayContent} />
                {stage === 'writing' && (
                  <span style={{
                    display: 'inline-block',
                    width: 2,
                    height: '1em',
                    background: '#5e6ad2',
                    marginLeft: 1,
                    animation: 'blink 1s step-end infinite',
                    verticalAlign: 'text-bottom',
                  }} />
                )}
              </pre>
            </div>

            {/* Stats bar */}
            {stage === 'done' && (
              <div style={{
                display: 'flex',
                gap: 20,
                marginTop: 10,
                padding: '0 4px',
              }}>
                {[
                  { label: 'characters', value: displayContent.length.toLocaleString() },
                  { label: 'lines', value: displayContent.split('\n').length.toLocaleString() },
                  { label: 'sections', value: (displayContent.match(/^## [①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬]/gm) || []).length },
                ].map(({ label, value }) => (
                  <span key={label} style={{ fontSize: 11, color: '#4a4a6a', fontFamily: 'monospace' }}>
                    {value} {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── How it works — idle state ── */}
        {stage === 'idle' && (
          <div style={{
            maxWidth: 640,
            margin: '48px auto 0',
            width: '100%',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 12,
          }}>
            {[
              {
                step: '01',
                title: 'Paste any URL',
                desc: 'Any public website. Our browser scrapes it completely — CSS, animations, hover states, scroll behavior.',
              },
              {
                step: '02',
                title: 'Claude analyzes',
                desc: 'Claude reads 9 scroll frames + hover pairs and writes a Design DNA — not a template, a real analysis.',
              },
              {
                step: '03',
                title: 'Use with Claude',
                desc: 'Give Claude 3 DNA files + your brief. It synthesizes the influences and builds something better.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} style={{
                padding: '20px',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.02)',
              }}>
                <div style={{ fontSize: 11, color: '#5e6ad2', fontFamily: 'monospace', marginBottom: 8 }}>{step}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#e8e8f0' }}>{title}</div>
                <div style={{ fontSize: 12, color: '#5a5a7a', lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes progress-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        input::placeholder { color: #3a3a5a; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
      `}</style>
    </div>
  );
}

// ─── Output with syntax highlighting ─────────────────────────────────────────

function OutputWithHighlighting({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split('\n');

  return (
    <>
      {lines.map((line, i) => {
        let color = '#c8c8e0';
        let fontWeight: number | undefined;
        let fontSize: string | undefined;

        if (line.startsWith('# ')) {
          color = '#f0f0f5';
          fontWeight = 700;
          fontSize = '14px';
        } else if (line.startsWith('## ')) {
          color = '#8b97f0';
          fontWeight = 600;
        } else if (line.startsWith('```')) {
          color = '#3dd68c';
        } else if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
          color = '#4a5a4a';
        } else if (line.includes(':') && !line.startsWith('-') && !line.startsWith('>')) {
          // CSS-like property lines
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0 && colonIdx < 40) {
            color = '#c8c8e0';
          }
        } else if (line.startsWith('>')) {
          color = '#9090b8';
          fontWeight = 400;
        } else if (line.startsWith('✓')) {
          color = '#3dd68c';
        } else if (line.startsWith('✗')) {
          color = '#e54d4d';
        } else if (line.startsWith('---') || line.startsWith('═')) {
          color = '#2a2a4a';
        }

        return (
          <span
            key={i}
            style={{ color, fontWeight, fontSize, display: 'block' }}
          >
            {line || '\u00A0'}
          </span>
        );
      })}
    </>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const actionBtnStyle: React.CSSProperties = {
  padding: '5px 12px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6,
  color: '#8888aa',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 0.15s ease',
};
