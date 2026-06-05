'use strict';

const { chromium } = require('playwright');

// ─── Main Entry Point ────────────────────────────────────────────────────────

async function extract(url, onProgress) {
  const progress = onProgress || (() => {});

  progress('Launching browser...');
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  await context.route('**/*.{mp4,webm,ogg,mp3,wav}', r => r.abort());

  const page = await context.newPage();

  // CRITICAL: Inject hooks BEFORE any page script runs
  progress('Injecting animation hooks...');
  await injectAnimationHooks(page);

  try {
    progress(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });

    // Let the page breathe — load animations start firing
    await page.waitForTimeout(800);

    progress('Reading load sequence from animation engine...');
    const loadSequence = await captureLoadSequence(page);

    progress('Reading animation libraries internal state...');
    const libraries = await detectAnimationLibraries(page);

    progress('Extracting CSS tokens...');
    const cssData = await extractCSS(page);

    const techStack = await detectTechStack(page, libraries);

    progress('Scrolling and reading animation triggers in real time...');
    const scrollAnimations = await captureScrollAnimations(page);

    progress('Capturing hover transitions from animation engine...');
    const hoverTransitions = await captureHoverTransitions(page);

    progress('Collecting observer and mutation data...');
    const hookData = await collectHookData(page);

    progress('Capturing visual screenshots...');
    const screenshots = await captureScreenshots(page);

    progress('Extracting DOM structure and design data...');
    const domStructure = await extractDOMStructure(page);
    const designData = await extractDesignData(page);

    const title = await page.title();

    return {
      url,
      title,
      extractedAt: new Date().toISOString(),
      techStack,
      cssData,
      designData,
      domStructure,
      animationEngine: {
        loadSequence,
        scrollAnimations,
        hoverTransitions,
        libraries,
        intersectionTriggers: hookData.ioLog,
        domMutations: hookData.mutationLog,
        typewriterEffects: hookData.typewriterEffects,
        classTogglePatterns: hookData.classToggles,
      },
      screenshots,
    };
  } finally {
    await browser.close();
  }
}

// ─── Phase 1: Inject Hooks Before Page Loads ────────────────────────────────

async function injectAnimationHooks(page) {
  await page.addInitScript(() => {
    window.__dna = {
      ioLog: [],
      mutationLog: [],
      classToggles: [],
      startTime: Date.now(),
    };

    // ── Intercept IntersectionObserver ──────────────────────────────
    // This catches EVERY scroll-triggered animation before the site sets it up
    const _OrigIO = window.IntersectionObserver;
    window.IntersectionObserver = function(callback, options) {
      const wrapped = (entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;
            window.__dna.ioLog.push({
              tag: el.tagName,
              class: (el.className || '').toString().slice(0, 150),
              id: el.id || null,
              threshold: Math.round(entry.intersectionRatio * 100) / 100,
              rootMargin: options?.rootMargin || '0px',
              scrollY: window.scrollY,
              t: Date.now() - window.__dna.startTime,
            });
          }
        });
        callback(entries, obs);
      };
      return new _OrigIO(wrapped, options);
    };
    try { Object.assign(window.IntersectionObserver, _OrigIO); } catch(_) {}

    // ── Track text changes and class mutations ───────────────────────
    window.__textChanges = {};

    const mo = new MutationObserver(mutations => {
      mutations.forEach(m => {
        const t = Date.now() - window.__dna.startTime;

        // Character-level text changes → detect typewriter
        if (m.type === 'characterData' && m.target.parentElement) {
          const parent = m.target.parentElement;
          const key = (parent.className || parent.tagName).toString().slice(0, 80);
          if (!window.__textChanges[key]) window.__textChanges[key] = [];
          window.__textChanges[key].push({
            text: m.target.textContent.slice(0, 200),
            t,
          });
        }

        // Class attribute changes → detect state-driven animations
        if (m.type === 'attributes' && m.attributeName === 'class') {
          const el = m.target;
          const oldVal = (m.oldValue || '').trim();
          const newVal = (el.className || '').toString().trim();
          if (oldVal !== newVal) {
            window.__dna.classToggles.push({
              tag: el.tagName,
              id: el.id || null,
              from: oldVal.slice(0, 100),
              to: newVal.slice(0, 100),
              added: newVal.split(' ').filter(c => c && !oldVal.includes(c)).join(' '),
              removed: oldVal.split(' ').filter(c => c && !newVal.includes(c)).join(' '),
              scrollY: window.scrollY,
              t,
            });
          }
        }
      });
    });

    const startMO = () => {
      try {
        mo.observe(document.body, {
          subtree: true,
          characterData: true,
          childList: false,
          attributes: true,
          attributeOldValue: true,
          attributeFilter: ['class', 'data-state', 'data-aos', 'aria-hidden', 'style'],
        });
      } catch(_) {}
    };

    if (document.body) {
      startMO();
    } else {
      document.addEventListener('DOMContentLoaded', startMO);
    }
  });
}

// ─── Phase 2: Load Sequence — Read Animation Engine During First 4 Seconds ──

async function captureLoadSequence(page) {
  const sequence = [];
  const seen = new Set();

  // Poll every 100ms for 4 seconds — catches everything that fires on load
  for (let tick = 0; tick < 40; tick++) {
    await page.waitForTimeout(100);

    const snapshot = await page.evaluate((elapsed) => {
      return document.getAnimations()
        .filter(a => a.playState === 'running' || (a.playState === 'finished' && a.currentTime < 2000))
        .map(anim => {
          try {
            const timing = anim.effect?.getTiming() || {};
            const kf = anim.effect?.getKeyframes() || [];
            const el = anim.effect?.target;
            return {
              element: el
                ? `${el.tagName}${el.id ? '#' + el.id : ''}.${(el.className || '').toString().split(' ').slice(0, 3).join('.')}`
                : 'unknown',
              playState: anim.playState,
              currentTime: Math.round(anim.currentTime || 0),
              timing: {
                duration: timing.duration,
                delay: timing.delay,
                easing: timing.easing,
                iterations: timing.iterations,
                fill: timing.fill,
                direction: timing.direction,
              },
              keyframes: kf.slice(0, 5).map(k => {
                const { offset, easing, composite, ...props } = k;
                // Clean up verbose transform values
                const cleaned = {};
                Object.entries(props).forEach(([key, val]) => {
                  if (typeof val === 'string') cleaned[key] = val.slice(0, 80);
                  else cleaned[key] = val;
                });
                return { offset, easing, ...cleaned };
              }),
              elapsed,
            };
          } catch(e) { return null; }
        }).filter(Boolean);
    }, tick * 100);

    snapshot.forEach(anim => {
      // Deduplicate by element + duration + easing fingerprint
      const key = `${anim.element}|${anim.timing.duration}|${anim.timing.easing}|${anim.timing.delay}`;
      if (!seen.has(key)) {
        seen.add(key);
        sequence.push(anim);
      }
    });
  }

  return sequence;
}

// ─── Phase 3: Animation Library Internal State ───────────────────────────────

async function detectAnimationLibraries(page) {
  return page.evaluate(() => {
    const libs = {};

    // ── GSAP ──────────────────────────────────────────────────────
    if (window.gsap) {
      const scrollTriggers = [];
      if (window.ScrollTrigger) {
        try {
          window.ScrollTrigger.getAll().slice(0, 25).forEach(st => {
            scrollTriggers.push({
              trigger: st.trigger?.className?.toString().slice(0, 80) || st.trigger?.tagName,
              triggerId: st.trigger?.id || null,
              start: st.vars?.start,
              end: st.vars?.end,
              toggleActions: st.vars?.toggleActions,
              scrub: st.vars?.scrub,
              pin: !!st.vars?.pin,
              markers: !!st.vars?.markers,
              animation: st.animation ? {
                duration: st.animation.duration?.(),
                ease: st.animation.vars?.ease?.toString?.()?.slice(0, 80),
                targets: st.animation.targets?.()?.slice(0, 3).map(t =>
                  `${t?.tagName}.${(t?.className||'').toString().slice(0,50)}`
                ),
                vars: Object.keys(st.animation.vars || {})
                  .filter(k => !['ease','onComplete','onUpdate','callbackScope','scrollTrigger'].includes(k))
                  .slice(0, 8),
              } : null,
            });
          });
        } catch(_) {}
      }

      let globalTimelineChildren = [];
      try {
        globalTimelineChildren = window.gsap.globalTimeline
          .getChildren(true, true, false)
          .slice(0, 20)
          .map(c => ({
            type: c.constructor?.name,
            duration: c.duration?.(),
            delay: c.delay?.(),
            ease: c.vars?.ease?.toString?.()?.slice(0, 60),
            targets: c.targets?.()?.slice(0, 3).map(t =>
              `${t?.tagName}.${(t?.className||'').toString().slice(0,50)}`
            ),
          }));
      } catch(_) {}

      libs.gsap = {
        detected: true,
        version: window.gsap.version,
        hasScrollTrigger: !!window.ScrollTrigger,
        hasScrollSmoother: !!window.ScrollSmoother,
        hasSplitText: !!window.SplitText,
        hasDrawSVG: !!window.DrawSVGPlugin,
        scrollTriggers,
        globalTimelineChildren,
      };
    }

    // ── Framer Motion ─────────────────────────────────────────────
    const framerElements = document.querySelectorAll('[style*="transform"]');
    libs.framerMotion = {
      detected: !!(
        document.querySelector('[data-framer-component-type]') ||
        document.querySelector('[style*="--framer"]') ||
        Array.from(document.scripts).some(s => s.src?.includes('framer-motion'))
      ),
      domElements: document.querySelectorAll('[data-framer-component-type]').length,
      transformElements: framerElements.length,
    };

    // ── Lenis Smooth Scroll ────────────────────────────────────────
    const lenisInstance = window.lenis || window.__lenis;
    libs.lenis = {
      detected: !!(window.lenis || window.Lenis || lenisInstance),
      lerp: lenisInstance?.options?.lerp ?? null,
      duration: lenisInstance?.options?.duration ?? null,
      easing: lenisInstance?.options?.easing?.toString?.()?.slice(0, 60) ?? null,
    };

    // ── Locomotive Scroll ─────────────────────────────────────────
    libs.locomotive = {
      detected: !!window.LocomotiveScroll,
    };

    // ── AOS ───────────────────────────────────────────────────────
    const aosElements = Array.from(document.querySelectorAll('[data-aos]'));
    libs.aos = {
      detected: !!window.AOS || aosElements.length > 0,
      totalElements: aosElements.length,
      uniqueAnimations: [...new Set(aosElements.map(el => el.getAttribute('data-aos')))],
      sample: aosElements.slice(0, 8).map(el => ({
        animation: el.getAttribute('data-aos'),
        duration: el.getAttribute('data-aos-duration'),
        delay: el.getAttribute('data-aos-delay'),
        easing: el.getAttribute('data-aos-easing'),
        offset: el.getAttribute('data-aos-offset'),
        once: el.getAttribute('data-aos-once'),
      })),
    };

    // ── Typewriter libraries ──────────────────────────────────────
    libs.typewriter = {
      typed: !!window.Typed,
      typeit: !!window.TypeIt,
      typewriterEffect: !!window.TypewriterEffect,
      domHints: document.querySelectorAll('.typed, [data-typed], .typewriter, .type-animate').length,
    };

    // ── Three.js / WebGL ──────────────────────────────────────────
    libs.threeJs = {
      detected: !!window.THREE,
      version: window.THREE?.REVISION ?? null,
      canvasCount: document.querySelectorAll('canvas').length,
    };

    // ── Spline ────────────────────────────────────────────────────
    libs.spline = {
      detected: !!document.querySelector('spline-viewer'),
    };

    // ── Motion One ────────────────────────────────────────────────
    libs.motionOne = {
      detected: !!window.motion || Array.from(document.scripts).some(s => s.src?.includes('motion')),
    };

    return libs;
  });
}

// ─── Phase 4: Scroll and Read Animation Triggers ─────────────────────────────

async function captureScrollAnimations(page) {
  const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportHeight = 900;
  const maxScroll = Math.max(0, totalHeight - viewportHeight);

  const results = [];
  const seen = new Set();

  // Scroll in 80px steps — fine enough to catch all triggers
  const steps = Math.min(Math.ceil(maxScroll / 80), 200); // cap at 200 steps

  for (let i = 0; i <= steps; i++) {
    const scrollY = Math.round((maxScroll / steps) * i);
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), scrollY);
    await page.waitForTimeout(180); // let animations actually start

    const running = await page.evaluate(() => {
      return document.getAnimations()
        .filter(a => a.playState === 'running')
        .map(anim => {
          try {
            const timing = anim.effect?.getTiming() || {};
            const kf = anim.effect?.getKeyframes() || [];
            const el = anim.effect?.target;
            return {
              element: el
                ? `${el.tagName}${el.id ? '#' + el.id : ''}.${(el.className||'').toString().split(' ').slice(0,3).join('.')}`
                : 'unknown',
              elementTag: el?.tagName,
              elementId: el?.id || null,
              timing: {
                duration: timing.duration,
                delay: timing.delay,
                easing: timing.easing,
                fill: timing.fill,
                iterations: timing.iterations,
              },
              keyframes: kf.slice(0, 5).map(k => {
                const { offset, easing, composite, ...props } = k;
                const cleaned = {};
                Object.entries(props).forEach(([key, val]) => {
                  if (typeof val === 'string') cleaned[key] = val.slice(0, 80);
                  else cleaned[key] = val;
                });
                return { offset, easing, ...cleaned };
              }),
              currentTime: Math.round(anim.currentTime || 0),
            };
          } catch(e) { return null; }
        }).filter(Boolean);
    });

    running.forEach(anim => {
      // Only log first time we see each unique animation
      const key = `${anim.element}|${anim.timing.duration}|${anim.timing.easing}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ triggeredAtScrollY: scrollY, ...anim });
      }
    });
  }

  // Return to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);

  return results;
}

// ─── Phase 5: Hover Transitions — Read Engine During Hover ──────────────────

async function captureHoverTransitions(page) {
  const targets = [
    { label: 'primary-button', sels: ['button:not([disabled])', '[class*="btn-primary"]', 'a[class*="cta"]', '[class*="button-primary"]'] },
    { label: 'secondary-button', sels: ['[class*="btn-secondary"]', '[class*="btn-outline"]', 'button:nth-of-type(2)'] },
    { label: 'card', sels: ['[class*="card"]', '[class*="feature-card"]', 'article'] },
    { label: 'nav-link', sels: ['nav a', 'header a:not([class*="btn"])'] },
    { label: 'link', sels: ['a:not([class*="btn"]):not(nav a)'] },
  ];

  const results = [];

  for (const { label, sels } of targets) {
    let el = null;
    for (const sel of sels) {
      try { el = await page.$(sel); if (el) break; } catch(_) {}
    }
    if (!el) continue;

    try {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);

      // Resting state: computed styles + any baseline animations
      const resting = await page.evaluate(element => {
        const s = getComputedStyle(element);
        return {
          transition: s.transition,
          animation: s.animation,
          transform: s.transform,
          opacity: s.opacity,
          color: s.color,
          backgroundColor: s.backgroundColor,
          boxShadow: s.boxShadow,
          border: s.border,
          outline: s.outline,
          filter: s.filter,
          scale: s.scale,
        };
      }, el);

      // Screenshots
      await page.mouse.move(0, 0);
      await page.waitForTimeout(200);
      const before = (await page.screenshot({ type: 'jpeg', quality: 65 })).toString('base64');

      // Hover and immediately start reading
      await el.hover({ timeout: 3000 });

      // Poll animation engine every 40ms during hover — 10 ticks = 400ms
      const hoverAnimations = [];
      const seenHoverAnims = new Set();

      for (let tick = 0; tick < 10; tick++) {
        await page.waitForTimeout(40);
        const anims = await page.evaluate(() => {
          return document.getAnimations()
            .filter(a => a.playState === 'running')
            .map(anim => {
              try {
                const timing = anim.effect?.getTiming() || {};
                const kf = anim.effect?.getKeyframes() || [];
                const el = anim.effect?.target;
                return {
                  element: `${el?.tagName}.${(el?.className||'').toString().split(' ').slice(0,3).join('.')}`,
                  timing: {
                    duration: timing.duration,
                    delay: timing.delay,
                    easing: timing.easing,
                  },
                  keyframes: kf.slice(0, 4).map(k => {
                    const { offset, easing, composite, ...props } = k;
                    return { offset, easing, ...props };
                  }),
                  currentTime: Math.round(anim.currentTime || 0),
                };
              } catch(e) { return null; }
            }).filter(Boolean);
        });

        anims.forEach(a => {
          const key = `${a.element}|${a.timing.duration}|${a.timing.easing}`;
          if (!seenHoverAnims.has(key)) {
            seenHoverAnims.add(key);
            hoverAnimations.push({ capturedAtMs: tick * 40, ...a });
          }
        });
      }

      // Hover state computed styles
      const hover = await page.evaluate(element => {
        const s = getComputedStyle(element);
        return {
          transition: s.transition,
          transform: s.transform,
          opacity: s.opacity,
          color: s.color,
          backgroundColor: s.backgroundColor,
          boxShadow: s.boxShadow,
          border: s.border,
          filter: s.filter,
          scale: s.scale,
        };
      }, el);

      const after = (await page.screenshot({ type: 'jpeg', quality: 65 })).toString('base64');

      // Move away and reset
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);

      results.push({
        label,
        restingStyles: resting,
        hoverStyles: hover,
        animationsDetectedDuringHover: hoverAnimations,
        before,
        after,
      });
    } catch(_) {}
  }

  return results;
}

// ─── Phase 6: Collect Hook Data ──────────────────────────────────────────────

async function collectHookData(page) {
  return page.evaluate(() => {
    const dna = window.__dna || {};
    const textChanges = window.__textChanges || {};

    // Analyze text changes for typewriter patterns
    const typewriterEffects = [];
    Object.entries(textChanges).forEach(([key, changes]) => {
      if (changes.length < 4) return;

      const intervals = [];
      for (let i = 1; i < Math.min(changes.length, 20); i++) {
        intervals.push(changes[i].t - changes[i - 1].t);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const isConsistent = intervals.every(i => Math.abs(i - avg) < 80);

      if (isConsistent && avg > 20 && avg < 300) {
        typewriterEffects.push({
          element: key,
          intervalMs: Math.round(avg),
          characterCount: changes.length,
          sample: {
            start: changes[0]?.text?.slice(0, 50),
            middle: changes[Math.floor(changes.length / 2)]?.text?.slice(0, 80),
            end: changes[changes.length - 1]?.text?.slice(0, 150),
          },
          startedAtMs: changes[0]?.t,
        });
      }
    });

    // Summarize class toggles into animation patterns
    const classTogglePatterns = [];
    const toggleGroups = {};
    (dna.classToggles || []).forEach(toggle => {
      const key = toggle.added || toggle.removed;
      if (!key) return;
      if (!toggleGroups[key]) toggleGroups[key] = [];
      toggleGroups[key].push(toggle);
    });
    Object.entries(toggleGroups).forEach(([className, toggles]) => {
      classTogglePatterns.push({
        className,
        occurrences: toggles.length,
        scrollPositions: toggles.map(t => t.scrollY).slice(0, 5),
        elements: [...new Set(toggles.map(t => t.tag))],
        firstToggleAt: toggles[0]?.t,
      });
    });

    return {
      ioLog: (dna.ioLog || []).slice(0, 60),
      mutationLog: (dna.mutationLog || []).slice(0, 40),
      typewriterEffects,
      classTogglePatterns,
    };
  });
}

// ─── Phase 7: CSS Extraction ─────────────────────────────────────────────────

async function extractCSS(page) {
  return page.evaluate(() => {
    const customProperties = {};
    const keyframes = [];
    const fontFaces = [];
    const transitions = new Set();

    // CSS custom properties from :root
    const rootStyles = getComputedStyle(document.documentElement);
    for (const prop of Array.from(rootStyles)) {
      if (prop.startsWith('--')) {
        const val = rootStyles.getPropertyValue(prop).trim();
        if (val) customProperties[prop] = val;
      }
    }

    // Process all stylesheets
    const processRules = rules => {
      try {
        Array.from(rules || []).forEach(rule => {
          if (rule instanceof CSSKeyframesRule) keyframes.push(rule.cssText);
          if (rule instanceof CSSFontFaceRule) fontFaces.push(rule.cssText);
          if (rule instanceof CSSMediaRule) processRules(rule.cssRules);
          if (rule instanceof CSSStyleRule) {
            const t = rule.style.transition;
            if (t && t !== 'none') transitions.add(`${rule.selectorText}: ${t}`);
          }
        });
      } catch(_) {}
    };
    Array.from(document.styleSheets).forEach(s => {
      try { processRules(s.cssRules); } catch(_) {}
    });

    // Computed styles of key elements
    const selectors = [
      { sel: 'body', label: 'body' },
      { sel: 'h1', label: 'h1' },
      { sel: 'h2', label: 'h2' },
      { sel: 'h3', label: 'h3' },
      { sel: 'p', label: 'paragraph' },
      { sel: 'nav a, header a', label: 'nav-link' },
      { sel: 'button:not([disabled]), [class*="btn"]', label: 'button' },
      { sel: '[class*="card"]', label: 'card' },
      { sel: 'input', label: 'input' },
      { sel: '[class*="hero"]', label: 'hero' },
    ];

    const computedStyles = {};
    selectors.forEach(({ sel, label }) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const s = getComputedStyle(el);
      computedStyles[label] = {
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        color: s.color,
        backgroundColor: s.backgroundColor,
        backgroundImage: s.backgroundImage !== 'none' ? s.backgroundImage?.slice(0, 200) : undefined,
        border: s.border,
        borderRadius: s.borderRadius,
        boxShadow: s.boxShadow !== 'none' ? s.boxShadow : undefined,
        padding: s.padding,
        transition: s.transition !== 'all 0s ease 0s' ? s.transition : undefined,
        animation: s.animation !== 'none 0s ease 0s 1 normal none running' ? s.animation : undefined,
        display: s.display,
        gap: s.gap,
        backdropFilter: s.backdropFilter !== 'none' ? s.backdropFilter : undefined,
        filter: s.filter !== 'none' ? s.filter : undefined,
      };
    });

    const googleFontsLinks = Array.from(
      document.querySelectorAll('link[href*="fonts.googleapis.com"]')
    ).map(l => l.href);

    const fontFamiliesUsed = new Set();
    const systemFonts = new Set(['serif','sans-serif','monospace','system-ui','-apple-system','BlinkMacSystemFont']);
    document.querySelectorAll('h1,h2,h3,p,button,a,nav').forEach(el => {
      getComputedStyle(el).fontFamily.split(',').forEach(f => {
        const clean = f.trim().replace(/['"]/g, '');
        if (!systemFonts.has(clean) && clean.length > 1) fontFamiliesUsed.add(clean);
      });
    });

    return {
      customProperties,
      keyframes: keyframes.slice(0, 30),
      fontFaces: fontFaces.slice(0, 10),
      transitions: Array.from(transitions).slice(0, 25),
      computedStyles,
      googleFontsLinks,
      fontFamiliesUsed: Array.from(fontFamiliesUsed).slice(0, 12),
    };
  });
}

// ─── Phase 8: Tech Stack ──────────────────────────────────────────────────────

async function detectTechStack(page, libraries) {
  const detected = await page.evaluate(() => {
    const scripts = Array.from(document.scripts).map(s => s.src).filter(Boolean);
    const getPath = src => { try { return new URL(src).pathname; } catch { return src; } };
    const paths = scripts.map(getPath);
    const html = document.documentElement.outerHTML.slice(0, 30000);

    return {
      framework: (() => {
        if (window.__NEXT_DATA__ || document.querySelector('#__NEXT_DATA__')) return 'Next.js';
        if (window.__NUXT__ || window.__nuxt__) return 'Nuxt';
        if (window.__remix_router__) return 'Remix';
        if (document.querySelector('[data-astro-cid]')) return 'Astro';
        if (document.querySelector('html[data-wf-page]')) return 'Webflow';
        if (document.querySelector('[data-framer-page-id]')) return 'Framer';
        if (window.ng || document.querySelector('[ng-version]')) return 'Angular';
        if (window.__vue_app__) return 'Vue';
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) return 'React';
        return 'Unknown';
      })(),
      tailwind: !!document.querySelector('[class*="text-"]') && !!document.querySelector('[class*="flex"]') && !!document.querySelector('[class*="px-"]'),
      bootstrap: !!document.querySelector('.container-fluid') || !!document.querySelector('[class*="col-md"]'),
      radix: !!document.querySelector('[data-radix-popper-content-wrapper]'),
      scriptCount: scripts.length,
    };
  });

  return {
    ...detected,
    animationLibraries: {
      gsap: libraries.gsap?.detected || false,
      gsapVersion: libraries.gsap?.version || null,
      scrollTrigger: libraries.gsap?.hasScrollTrigger || false,
      framerMotion: libraries.framerMotion?.detected || false,
      lenis: libraries.lenis?.detected || false,
      locomotive: libraries.locomotive?.detected || false,
      aos: libraries.aos?.detected || false,
      typed: libraries.typewriter?.typed || false,
      threeJs: libraries.threeJs?.detected || false,
    },
  };
}

// ─── Phase 9: Screenshots ─────────────────────────────────────────────────────

async function captureScreenshots(page) {
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = 900;
  const screenshots = [];
  // Fewer screenshots now — animation data is the main source of truth
  const positions = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1];

  for (const pct of positions) {
    const y = Math.max(0, Math.floor((total - vh) * pct));
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y);
    await page.waitForTimeout(600);
    const buf = await page.screenshot({ type: 'jpeg', quality: 65, clip: { x: 0, y: 0, width: 1440, height: 900 } });
    screenshots.push({ scrollPercent: Math.round(pct * 100), scrollY: y, data: buf.toString('base64') });
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  return screenshots;
}

// ─── Phase 10: DOM Structure ──────────────────────────────────────────────────

async function extractDOMStructure(page) {
  return page.evaluate(() => ({
    hasNav: !!document.querySelector('nav, header nav'),
    hasHero: !!(document.querySelector('[class*="hero"]') || document.querySelector('[class*="banner"]')),
    hasModal: !!(document.querySelector('[role="dialog"]') || document.querySelector('[class*="modal"]')),
    hasCarousel: !!(document.querySelector('[class*="carousel"]') || document.querySelector('[class*="slider"]')),
    hasAccordion: !!(document.querySelector('details') || document.querySelector('[class*="accordion"]')),
    hasForm: !!document.querySelector('form'),
    hasTabs: !!(document.querySelector('[role="tablist"]') || document.querySelector('[class*="tab"]')),
    hasVideoBackground: !!document.querySelector('video[autoplay]'),
    hasCustomCursor: !!document.querySelector('[class*="cursor"]'),
    sectionCount: document.querySelectorAll('section').length,
    dataAttributes: [...new Set(
      Array.from(document.querySelectorAll('*'))
        .flatMap(el => Array.from(el.attributes).map(a => a.name))
        .filter(a => a.startsWith('data-') && !['data-id','data-src','data-href'].includes(a))
    )].slice(0, 25),
  }));
}

// ─── Phase 11: Design Data ────────────────────────────────────────────────────

async function extractDesignData(page) {
  return page.evaluate(() => {
    const headingSizes = {};
    ['h1','h2','h3','h4'].forEach(tag => {
      const el = document.querySelector(tag);
      if (!el) return;
      const s = getComputedStyle(el);
      headingSizes[tag] = {
        fontSize: s.fontSize, fontWeight: s.fontWeight,
        lineHeight: s.lineHeight, letterSpacing: s.letterSpacing,
        fontFamily: s.fontFamily, color: s.color,
      };
    });

    const colorSamples = new Set();
    const bgSamples = new Set();
    document.querySelectorAll('h1,h2,h3,p,button,nav,section,[class*="card"]').forEach(el => {
      const s = getComputedStyle(el);
      if (s.color && s.color !== 'rgba(0, 0, 0, 0)') colorSamples.add(s.color);
      if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)') bgSamples.add(s.backgroundColor);
    });

    const stickyElements = Array.from(document.querySelectorAll('*'))
      .filter(el => ['sticky','fixed'].includes(getComputedStyle(el).position))
      .map(el => ({ tag: el.tagName, class: (el.className||'').toString().slice(0,60), position: getComputedStyle(el).position }))
      .slice(0, 5);

    return {
      pageHeight: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      headingSizes,
      colorSamples: Array.from(colorSamples).slice(0, 15),
      bgSamples: Array.from(bgSamples).slice(0, 12),
      stickyElements,
      totalSectionCount: document.querySelectorAll('section').length,
    };
  });
}

module.exports = { extract };
