'use strict';

const { chromium } = require('playwright');

// ─── Main extraction entry point ────────────────────────────────────────────

async function extract(url, onProgress) {
  const progress = onProgress || (() => {});
  
  progress('Launching browser...');
  const browser = await chromium.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--disable-gpu',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // Block heavy resources we don't need
  await page.route('**/*.{mp4,webm,ogg,mp3,wav,flac}', route => route.abort());
  await page.route('**/analytics/**', route => route.abort());
  await page.route('**/gtag/**', route => route.abort());

  try {
    progress(`Navigating to ${url}...`);
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });

    // Wait for fonts, images, lazy-loaded content
    await page.waitForTimeout(2000);

    // Scroll once to trigger lazy animations, then back to top
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    progress('Detecting tech stack...');
    const techStack = await detectTechStack(page);

    progress('Extracting CSS tokens & animations...');
    const cssData = await extractCSS(page);

    progress('Extracting typography & layout...');
    const designData = await extractDesignData(page);

    progress('Capturing scroll screenshots...');
    const screenshots = await captureScrollScreenshots(page);

    progress('Capturing hover states...');
    const hoverCaptures = await captureHoverStates(page);

    progress('Extracting DOM structure...');
    const domStructure = await extractDOMStructure(page);

    const title = await page.title();

    return {
      url,
      title,
      extractedAt: new Date().toISOString(),
      techStack,
      cssData,
      designData,
      domStructure,
      screenshots,
      hoverCaptures,
    };
  } finally {
    await browser.close();
  }
}

// ─── Tech Stack Detection ────────────────────────────────────────────────────

async function detectTechStack(page) {
  return page.evaluate(() => {
    const w = window;
    const scripts = Array.from(document.scripts)
      .map(s => s.src)
      .filter(Boolean);

    const getScriptPaths = srcs =>
      srcs.map(s => {
        try { return new URL(s).pathname; }
        catch { return s; }
      });

    const scriptPaths = getScriptPaths(scripts);
    const html = document.documentElement.outerHTML;
    const classes = document.documentElement.className + document.body.className;

    // Helper: check if class pattern exists anywhere
    const hasClass = pattern =>
      !!document.querySelector(`[class*="${pattern}"]`);

    return {
      // ── Frameworks ──
      framework: (() => {
        if (w.__NEXT_DATA__ || document.querySelector('#__NEXT_DATA__')) return 'Next.js';
        if (w.__NUXT__ || w.__nuxt__) return 'Nuxt';
        if (w.__remix_router__) return 'Remix';
        if (w.__svelte__) return 'SvelteKit';
        if (document.querySelector('[data-astro-cid]')) return 'Astro';
        if (document.querySelector('html[data-wf-page]')) return 'Webflow';
        if (document.querySelector('[data-framer-page-id]')) return 'Framer';
        if (w.ng || document.querySelector('[ng-version]')) return 'Angular';
        if (w.__vue_app__ || w.Vue) return 'Vue';
        if (w.__REACT_DEVTOOLS_GLOBAL_HOOK__ || w.React) return 'React';
        return 'Unknown';
      })(),

      // ── Animation libraries ──
      gsap: !!(w.gsap || w.TweenMax || w.TweenLite),
      gsapVersion: w.gsap?.version || null,
      scrollTrigger: !!(w.ScrollTrigger || w.gsap?.plugins?.ScrollTrigger),
      framerMotion: !!(
        document.querySelector('[data-framer-component-type]') ||
        document.querySelector('[style*="--framer"]') ||
        scriptPaths.some(p => p.includes('framer-motion'))
      ),
      aos: !!(w.AOS || document.querySelectorAll('[data-aos]').length > 0),
      aosElements: document.querySelectorAll('[data-aos]').length,
      scrollReveal: !!w.ScrollReveal,
      motionOne: !!w.motion,
      lottie: !!(w.lottie || w.LottiePlayer || document.querySelector('lottie-player')),
      anime: !!w.anime,

      // ── Scroll ──
      lenis: !!(w.lenis || w.Lenis || scriptPaths.some(p => p.includes('lenis'))),
      locomotive: !!(w.LocomotiveScroll || scriptPaths.some(p => p.includes('locomotive'))),
      nativeSmoothScroll: document.documentElement.style.scrollBehavior === 'smooth'
        || getComputedStyle(document.documentElement).scrollBehavior === 'smooth',

      // ── CSS approach ──
      tailwind: hasClass('text-') && hasClass('flex') && hasClass('px-'),
      bootstrap: hasClass('col-') || !!document.querySelector('.container-fluid'),
      cssModules: scriptPaths.some(p => p.includes('.module')),

      // ── UI component libraries ──
      radix: !!document.querySelector('[data-radix-popper-content-wrapper]'),
      headlessui: !!document.querySelector('[data-headlessui-state]'),
      shadcn: hasClass('shadcn') || scriptPaths.some(p => p.includes('shadcn')),

      // ── Icons ──
      lucide: scriptPaths.some(p => p.includes('lucide')),
      phosphor: scriptPaths.some(p => p.includes('phosphor')),
      heroicons: scriptPaths.some(p => p.includes('heroicons')),

      // ── Special features ──
      webgl: !!document.querySelector('canvas') && !!w.WebGLRenderingContext,
      threeJs: !!w.THREE,
      spline: !!document.querySelector('spline-viewer'),
      particles: !!(w.particlesJS || w.tsParticles || document.querySelector('#particles')),
      splitType: !!(w.SplitType || w.SplitText),
      customCursor: !!document.querySelector('[class*="cursor"]') || !!document.querySelector('[data-cursor]'),
      magneticElements: document.querySelectorAll('[data-magnetic]').length,
      videoBackground: !!document.querySelector('video'),
      canvasAnimations: document.querySelectorAll('canvas').length,

      // ── Detected script sources ──
      scriptSources: scriptPaths.slice(0, 30),
    };
  });
}

// ─── CSS Extraction ──────────────────────────────────────────────────────────

async function extractCSS(page) {
  return page.evaluate(() => {
    // ── CSS Custom Properties from :root ──
    const customProperties = {};
    const rootStyles = getComputedStyle(document.documentElement);
    for (const prop of Array.from(rootStyles)) {
      if (prop.startsWith('--')) {
        const value = rootStyles.getPropertyValue(prop).trim();
        if (value) customProperties[prop] = value;
      }
    }

    // Also check body-level custom properties
    const bodyStyles = getComputedStyle(document.body);
    for (const prop of Array.from(bodyStyles)) {
      if (prop.startsWith('--') && !customProperties[prop]) {
        const value = bodyStyles.getPropertyValue(prop).trim();
        if (value) customProperties[prop] = value;
      }
    }

    // ── @keyframes & @font-face from stylesheets ──
    const keyframes = [];
    const fontFaces = [];
    const mediaQueries = [];
    const allTransitions = new Set();
    const allAnimationNames = new Set();

    const processRules = rules => {
      try {
        Array.from(rules).forEach(rule => {
          if (rule instanceof CSSKeyframesRule) {
            keyframes.push(rule.cssText);
          }
          if (rule instanceof CSSFontFaceRule) {
            fontFaces.push(rule.cssText);
          }
          if (rule instanceof CSSMediaRule) {
            mediaQueries.push(rule.conditionText);
            processRules(rule.cssRules);
          }
          if (rule instanceof CSSStyleRule) {
            const t = rule.style.transition;
            const a = rule.style.animation;
            if (t && t !== 'none' && t !== '') allTransitions.add(`${rule.selectorText}: ${t}`);
            if (a && a !== 'none' && a !== '') {
              allAnimationNames.add(a.split(' ')[0]);
            }
          }
        });
      } catch (_) { /* cross-origin */ }
    };

    Array.from(document.styleSheets).forEach(sheet => {
      try { processRules(sheet.cssRules || []); } catch (_) {}
    });

    // ── Computed styles of key elements ──
    const selectors = [
      { sel: 'body', label: 'body' },
      { sel: 'h1, [class*="hero"] h1', label: 'h1' },
      { sel: 'h2', label: 'h2' },
      { sel: 'h3', label: 'h3' },
      { sel: 'p', label: 'paragraph' },
      { sel: 'nav, header nav', label: 'nav' },
      { sel: 'nav a, header a', label: 'nav-link' },
      { sel: 'button, [class*="btn"]', label: 'button-primary' },
      { sel: 'a[class*="btn"]:not(nav a)', label: 'button-secondary' },
      { sel: '[class*="card"]', label: 'card' },
      { sel: 'input, textarea', label: 'input' },
      { sel: '[class*="badge"], [class*="tag"], [class*="chip"]', label: 'badge' },
      { sel: 'footer', label: 'footer' },
      { sel: '[class*="hero"]', label: 'hero-section' },
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
        backgroundImage: s.backgroundImage !== 'none' ? s.backgroundImage : undefined,
        border: s.border,
        borderRadius: s.borderRadius,
        boxShadow: s.boxShadow !== 'none' ? s.boxShadow : undefined,
        padding: s.padding,
        margin: s.margin,
        transition: s.transition !== 'all 0s ease 0s' ? s.transition : undefined,
        animation: s.animation !== 'none 0s ease 0s 1 normal none running' ? s.animation : undefined,
        display: s.display,
        flexDirection: s.flexDirection,
        gridTemplateColumns: s.gridTemplateColumns !== 'none' ? s.gridTemplateColumns : undefined,
        gap: s.gap,
        maxWidth: s.maxWidth,
        textTransform: s.textTransform !== 'none' ? s.textTransform : undefined,
        filter: s.filter !== 'none' ? s.filter : undefined,
        backdropFilter: s.backdropFilter !== 'none' ? s.backdropFilter : undefined,
        opacity: s.opacity !== '1' ? s.opacity : undefined,
        position: s.position,
      };
    });

    // ── Google Fonts detection ──
    const googleFontsLinks = Array.from(
      document.querySelectorAll('link[href*="fonts.googleapis.com"]')
    ).map(l => l.href);

    // ── Font families in use ──
    const fontFamiliesUsed = new Set();
    const systemFonts = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
      'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto',
      'Helvetica Neue', 'Arial', 'Helvetica']);

    document.querySelectorAll('h1, h2, h3, p, button, a, nav, [class*="hero"]').forEach(el => {
      const ff = getComputedStyle(el).fontFamily;
      ff.split(',').forEach(f => {
        const clean = f.trim().replace(/['"]/g, '');
        if (!systemFonts.has(clean) && clean.length > 1) fontFamiliesUsed.add(clean);
      });
    });

    return {
      customProperties,
      keyframes: keyframes.slice(0, 30),
      fontFaces: fontFaces.slice(0, 15),
      transitions: Array.from(allTransitions).slice(0, 30),
      animationNames: Array.from(allAnimationNames),
      computedStyles,
      googleFontsLinks,
      fontFamiliesUsed: Array.from(fontFamiliesUsed).slice(0, 15),
      mediaQueryBreakpoints: [...new Set(mediaQueries)].slice(0, 10),
    };
  });
}

// ─── Design Data Extraction ──────────────────────────────────────────────────

async function extractDesignData(page) {
  return page.evaluate(() => {
    // ── Layout measurements ──
    const body = document.body;
    const pageWidth = body.scrollWidth;
    const pageHeight = body.scrollHeight;
    const viewportWidth = window.innerWidth;

    // Find max-width containers
    const containers = Array.from(document.querySelectorAll('main, .container, [class*="container"], [class*="wrapper"], [class*="layout"]'))
      .map(el => ({
        tag: el.tagName,
        class: el.className.slice(0, 50),
        maxWidth: getComputedStyle(el).maxWidth,
        width: el.getBoundingClientRect().width,
      }))
      .filter(c => c.maxWidth !== 'none' || c.width < viewportWidth * 0.95)
      .slice(0, 5);

    // ── Section analysis ──
    const sections = Array.from(document.querySelectorAll('section, [class*="section"], main > div'))
      .map((el, i) => {
        const s = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          index: i,
          height: Math.round(rect.height),
          paddingTop: s.paddingTop,
          paddingBottom: s.paddingBottom,
          backgroundColor: s.backgroundColor,
          backgroundImage: s.backgroundImage !== 'none' ? s.backgroundImage.slice(0, 100) : null,
          hasAnimation: !!(s.animation && s.animation !== 'none 0s ease 0s 1 normal none running'),
          hasTransition: !!(s.transition && s.transition !== 'all 0s ease 0s'),
        };
      })
      .slice(0, 12);

    // ── Scroll & parallax detection ──
    const hasParallax =
      document.querySelectorAll('[data-parallax], [data-speed], [class*="parallax"]').length > 0;

    const stickyElements = Array.from(
      document.querySelectorAll('*')
    ).filter(el => {
      const pos = getComputedStyle(el).position;
      return pos === 'sticky' || pos === 'fixed';
    }).map(el => ({
      tag: el.tagName,
      class: el.className.slice(0, 50),
      position: getComputedStyle(el).position,
    })).slice(0, 5);

    // ── Color palette extraction from computed styles ──
    const colorSamples = new Set();
    const bgSamples = new Set();

    document.querySelectorAll('h1, h2, h3, p, button, a, nav, [class*="card"], [class*="hero"], section, main').forEach(el => {
      const s = getComputedStyle(el);
      if (s.color && s.color !== 'rgba(0, 0, 0, 0)') colorSamples.add(s.color);
      if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)') bgSamples.add(s.backgroundColor);
    });

    // ── Typography scale ──
    const headingSizes = {};
    ['h1', 'h2', 'h3', 'h4', 'h5'].forEach(tag => {
      const el = document.querySelector(tag);
      if (el) {
        const s = getComputedStyle(el);
        headingSizes[tag] = {
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          lineHeight: s.lineHeight,
          letterSpacing: s.letterSpacing,
          fontFamily: s.fontFamily,
          color: s.color,
          textTransform: s.textTransform,
        };
      }
    });

    // ── Cursor type ──
    const cursorElements = Array.from(document.querySelectorAll('[class*="cursor"]')).map(el => ({
      class: el.className.slice(0, 80),
      computedCursor: getComputedStyle(el).cursor,
    })).slice(0, 3);

    return {
      pageHeight,
      pageWidth,
      viewportWidth,
      containers,
      sections: sections.filter(s => s.height > 100),
      hasParallax,
      stickyElements,
      colorSamples: Array.from(colorSamples).slice(0, 20),
      bgSamples: Array.from(bgSamples).slice(0, 15),
      headingSizes,
      cursorElements,
      totalSectionCount: sections.length,
    };
  });
}

// ─── Screenshot Capture ──────────────────────────────────────────────────────

async function captureScrollScreenshots(page) {
  const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportHeight = 900;
  const screenshots = [];

  // Sample at these scroll percentages
  const positions = [0, 0.08, 0.18, 0.3, 0.45, 0.6, 0.75, 0.88, 0.96];

  for (const pct of positions) {
    const scrollY = Math.max(0, Math.floor((totalHeight - viewportHeight) * pct));
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), scrollY);
    await page.waitForTimeout(700); // Let scroll-triggered animations settle

    const buffer = await page.screenshot({
      type: 'jpeg',
      quality: 68,
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    });

    screenshots.push({
      scrollPercent: Math.round(pct * 100),
      scrollY,
      data: buffer.toString('base64'),
    });
  }

  // Return to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  return screenshots;
}

// ─── Hover State Capture ─────────────────────────────────────────────────────

async function captureHoverStates(page) {
  const captures = [];

  const targets = [
    {
      label: 'primary-button',
      selectors: ['button:not([disabled])', '[class*="btn-primary"]', 'a[class*="btn"]', '[class*="cta"]'],
    },
    {
      label: 'card',
      selectors: ['[class*="card"]', '[class*="feature"]', 'article'],
    },
    {
      label: 'nav-link',
      selectors: ['nav a', 'header a:not([class*="btn"])'],
    },
    {
      label: 'secondary-button',
      selectors: ['[class*="btn-secondary"]', '[class*="btn-outline"]', 'button:nth-of-type(2)'],
    },
  ];

  for (const { label, selectors } of targets) {
    let element = null;

    for (const sel of selectors) {
      try {
        element = await page.$(sel);
        if (element) break;
      } catch (_) {}
    }

    if (!element) continue;

    try {
      // Make sure element is in viewport
      await element.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      // Capture before hover
      const before = await page.screenshot({ type: 'jpeg', quality: 65 });

      // Hover
      await element.hover({ timeout: 3000 });
      await page.waitForTimeout(350);

      // Capture after hover
      const after = await page.screenshot({ type: 'jpeg', quality: 65 });

      // Move away
      await page.mouse.move(100, 100);
      await page.waitForTimeout(200);

      captures.push({
        label,
        before: before.toString('base64'),
        after: after.toString('base64'),
      });
    } catch (_) {
      // Element not hoverable or caused error — skip
    }
  }

  return captures;
}

// ─── DOM Structure Analysis ──────────────────────────────────────────────────

async function extractDOMStructure(page) {
  return page.evaluate(() => {
    return {
      hasNav: !!document.querySelector('nav, header nav'),
      hasFooter: !!document.querySelector('footer'),
      hasHero: !!(
        document.querySelector('[class*="hero"]') ||
        document.querySelector('[class*="banner"]') ||
        document.querySelector('header + section, header + main')
      ),
      hasModal: !!(document.querySelector('[class*="modal"]') || document.querySelector('[role="dialog"]')),
      hasToast: !!document.querySelector('[class*="toast"], [class*="notification"]'),
      hasCarousel: !!(document.querySelector('[class*="carousel"]') || document.querySelector('[class*="slider"]')),
      hasAccordion: !!(document.querySelector('[class*="accordion"]') || document.querySelector('details')),
      hasForm: !!document.querySelector('form'),
      hasTabs: !!(document.querySelector('[role="tablist"]') || document.querySelector('[class*="tab"]')),
      hasVideoBackground: !!document.querySelector('video[autoplay], video[class*="bg"]'),
      sectionCount: document.querySelectorAll('section').length,
      totalImages: document.querySelectorAll('img').length,
      hasSVGIllustrations: document.querySelectorAll('svg:not([class*="icon"]):not([class*="logo"])').length > 2,
      hasInlineAnimation: document.querySelectorAll('[style*="animation"]').length,
      dataAttributes: Array.from(new Set(
        Array.from(document.querySelectorAll('*'))
          .flatMap(el => Array.from(el.attributes).map(a => a.name))
          .filter(a => a.startsWith('data-') && !['data-id', 'data-src', 'data-href'].includes(a))
      )).slice(0, 20),
    };
  });
}

module.exports = { extract };
