// @ts-nocheck
// ─── Design DNA Claude Prompt ────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are an elite design analyst — part world-class UI/UX designer, part senior frontend engineer. You have spent your career studying the world's best digital products and can identify every design decision from a CSS value to a motion philosophy.

You will receive data captured by reading the browser's animation engine directly — not from screenshots, not from guessing. The timing values, easing curves, and keyframe data are EXACT, extracted from the browser's own animation system in real time.

You will also receive:
- CSS custom properties and @keyframes extracted directly from stylesheets
- Animation library internal state (GSAP timelines, ScrollTrigger configs, Lenis settings)
- IntersectionObserver triggers with exact scroll positions
- MutationObserver data showing class toggles and typewriter effects
- Hover transition data captured by polling the animation engine during hover
- Screenshots for visual context

Your mission: Write a comprehensive Design DNA document that captures this site's complete design system so thoroughly that someone could recreate its FEEL, AESTHETIC, and MOTION in any technology.

═══ WRITING RULES ═══

1. The animation engine data contains EXACT values — use them verbatim. Never round a cubic-bezier. Never approximate a duration that was directly measured.

2. The scroll animation data shows exactly WHAT triggered at WHAT scroll position. Use this to document the scroll choreography precisely.

3. The hover animation data was captured by reading the engine during hover — document every property that changed, the exact duration, the exact easing.

4. Typewriter effects have measured character intervals — document the speed in ms.

5. Class toggle patterns reveal animation triggers — document what class gets added/removed and what visual change it produces.

6. Write proportionally. Complex animated sites deserve 500+ lines. Simple sites get clean sparse docs. Never pad.

7. The ⑬ RECREATION BRIEF must always be present and always be copy-pasteable as a Claude prompt.

8. Output ONLY the markdown. No preamble. Start with # DESIGN DNA — [site name].

SECTION HEADERS:
① AESTHETIC PROFILE
② TECH STACK
③ COLOR SYSTEM
④ TYPOGRAPHY SYSTEM
⑤ SPACING & LAYOUT
⑥ MOTION & ANIMATION SYSTEM
⑦ VISUAL EFFECTS & ATMOSPHERE
⑧ COMPONENT LIBRARY
⑨ INTERACTION PATTERNS
⑩ DESIGN RULES
⑪ CSS TOKENS — ready to paste
⑫ ANIMATION PRIMITIVES — ready to paste
⑬ RECREATION BRIEF`;

// ─── Build Claude Messages ────────────────────────────────────────────────────

export function buildClaudeMessages(data) {
  const { url, title, extractedAt, techStack, cssData, designData, domStructure, animationEngine, screenshots } = data;

  const textContent = buildTextContent({ url, title, extractedAt, techStack, cssData, designData, domStructure, animationEngine });

  const contentBlocks = [];
  contentBlocks.push({ type: 'text', text: textContent });

  // Screenshots for visual context
  contentBlocks.push({
    type: 'text',
    text: `\n\n${'═'.repeat(50)}\nVISUAL SCREENSHOTS (${screenshots.length} frames — for visual context only)
The animation data above is more precise than what screenshots can show.
Use these to understand layout, color, and visual hierarchy.
═══════════════════════════════════════`,
  });

  screenshots.forEach((s, i) => {
    contentBlocks.push({ type: 'text', text: `\n--- Scroll ${s.scrollPercent}% ---` });
    contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: s.data } });
  });

  // Hover captures
  if (animationEngine?.hoverTransitions?.length > 0) {
    contentBlocks.push({
      type: 'text',
      text: `\n\n═══════════════════════════════════════
HOVER STATE CAPTURES
Animation engine data is in the text above. These images show the visual delta.
═══════════════════════════════════════`,
    });

    animationEngine.hoverTransitions.forEach((h, i) => {
      if (!h.before || !h.after) return;
      contentBlocks.push({ type: 'text', text: `\n--- ${h.label.toUpperCase()} — Before hover:` });
      contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: h.before } });
      contentBlocks.push({ type: 'text', text: `${h.label.toUpperCase()} — After hover:` });
      contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: h.after } });
    });
  }

  contentBlocks.push({
    type: 'text',
    text: `\n\n═══════════════════════════════════════
Write the complete Design DNA document now.
Start with # DESIGN DNA — [site name]
═══════════════════════════════════════`,
  });

  return [{ role: 'user', content: contentBlocks }];
}

// ─── Format All Data As Structured Text ──────────────────────────────────────

function buildTextContent({ url, title, extractedAt, techStack, cssData, designData, domStructure, animationEngine }) {
  const L = [];

  L.push(`# Design DNA Extraction`);
  L.push(`URL: ${url}`);
  L.push(`Title: ${title}`);
  L.push(`Extracted: ${extractedAt}`);

  // ── Tech Stack ──
  L.push(`\n\n${'═'.repeat(50)}`);
  L.push(`TECH STACK`);
  L.push(`${'═'.repeat(50)}`);
  L.push(JSON.stringify(techStack, null, 2));

  // ── Animation Engine: Load Sequence ──
  const { loadSequence, scrollAnimations, hoverTransitions, libraries, intersectionTriggers, domMutations, typewriterEffects, classTogglePatterns } = animationEngine || {};

  L.push(`\n\n${'═'.repeat(50)}`);
  L.push(`ANIMATION ENGINE — PAGE LOAD SEQUENCE`);
  L.push(`${(loadSequence||[]).length} animations captured in first 4 seconds`);
  L.push(`All values are EXACT — read from browser animation engine`);
  L.push(`${'═'.repeat(50)}`);

  (loadSequence || []).forEach((anim, i) => {
    L.push(`\n[${i + 1}] ${anim.element}`);
    L.push(`  Started at:  ${anim.elapsed}ms after load`);
    L.push(`  Duration:    ${anim.timing?.duration}ms`);
    L.push(`  Delay:       ${anim.timing?.delay}ms`);
    L.push(`  Easing:      ${anim.timing?.easing}`);
    L.push(`  Fill:        ${anim.timing?.fill}`);
    L.push(`  Iterations:  ${anim.timing?.iterations}`);
    if (anim.keyframes?.length) {
      L.push(`  Keyframes:`);
      anim.keyframes.forEach(kf => {
        L.push(`    offset ${kf.offset}: ${JSON.stringify(kf).slice(0, 150)}`);
      });
    }
  });

  // ── Animation Engine: Scroll Animations ──
  L.push(`\n\n${'═'.repeat(50)}`);
  L.push(`ANIMATION ENGINE — SCROLL-TRIGGERED ANIMATIONS`);
  L.push(`${(scrollAnimations||[]).length} unique animations triggered during scroll`);
  L.push(`${'═'.repeat(50)}`);

  (scrollAnimations || []).forEach((anim, i) => {
    L.push(`\n[${i + 1}] ${anim.element}`);
    L.push(`  Triggered at scroll: ${anim.triggeredAtScrollY}px`);
    L.push(`  Duration:   ${anim.timing?.duration}ms`);
    L.push(`  Easing:     ${anim.timing?.easing}`);
    L.push(`  Delay:      ${anim.timing?.delay}ms`);
    L.push(`  Fill:       ${anim.timing?.fill}`);
    if (anim.keyframes?.length) {
      anim.keyframes.forEach(kf => {
        L.push(`  offset ${kf.offset}: ${JSON.stringify(kf).slice(0, 150)}`);
      });
    }
  });

  // ── Animation Engine: Hover Transitions ──
  L.push(`\n\n${'═'.repeat(50)}`);
  L.push(`ANIMATION ENGINE — HOVER TRANSITIONS`);
  L.push(`Captured by polling animation engine during hover`);
  L.push(`${'═'.repeat(50)}`);

  (hoverTransitions || []).forEach(h => {
    L.push(`\n[${h.label.toUpperCase()}]`);
    L.push(`Resting styles:`);
    Object.entries(h.restingStyles || {}).forEach(([k, v]) => {
      if (v && v !== 'none' && v !== 'normal' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') {
        L.push(`  ${k}: ${String(v).slice(0, 100)}`);
      }
    });
    L.push(`Hover styles:`);
    Object.entries(h.hoverStyles || {}).forEach(([k, v]) => {
      if (v && v !== 'none' && v !== 'normal' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') {
        L.push(`  ${k}: ${String(v).slice(0, 100)}`);
      }
    });
    if (h.animationsDetectedDuringHover?.length) {
      L.push(`Animations running during hover:`);
      h.animationsDetectedDuringHover.forEach(a => {
        L.push(`  ${a.element}: ${a.timing?.duration}ms, easing: ${a.timing?.easing}`);
        if (a.keyframes?.length) {
          a.keyframes.forEach(kf => L.push(`    offset ${kf.offset}: ${JSON.stringify(kf).slice(0, 120)}`));
        }
      });
    }
  });

  // ── IntersectionObserver Triggers ──
  L.push(`\n\n${'═'.repeat(50)}`);
  L.push(`INTERSECTION OBSERVER — SCROLL TRIGGERS`);
  L.push(`${(intersectionTriggers||[]).length} elements triggered during scroll`);
  L.push(`${'═'.repeat(50)}`);

  (intersectionTriggers || []).slice(0, 40).forEach(io => {
    L.push(`  scrollY ${io.scrollY}px | threshold ${io.threshold} | ${io.tag}.${(io.class||'').split(' ').slice(0,3).join('.')}`);
  });

  // ── Typewriter Effects ──
  if ((typewriterEffects || []).length > 0) {
    L.push(`\n\n${'═'.repeat(50)}`);
    L.push(`TYPEWRITER EFFECTS DETECTED`);
    L.push(`${'═'.repeat(50)}`);
    typewriterEffects.forEach(tw => {
      L.push(`\nElement: ${tw.element}`);
      L.push(`  Character interval: ${tw.intervalMs}ms per character`);
      L.push(`  Characters typed: ${tw.characterCount}`);
      L.push(`  Started at: ${tw.startedAtMs}ms after load`);
      L.push(`  Sample text: "${tw.sample?.end?.slice(0, 100)}"`);
    });
  }

  // ── Class Toggle Patterns ──
  if ((classTogglePatterns || []).length > 0) {
    L.push(`\n\n${'═'.repeat(50)}`);
    L.push(`CLASS TOGGLE PATTERNS (animation triggers)`);
    L.push(`${'═'.repeat(50)}`);
    classTogglePatterns.slice(0, 20).forEach(p => {
      L.push(`  Class: "${p.className}" | ${p.occurrences}x on ${p.elements.join(',')} | at scroll positions: ${p.scrollPositions.join(', ')}px`);
    });
  }

  // ── Animation Library Internal State ──
  L.push(`\n\n${'═'.repeat(50)}`);
  L.push(`ANIMATION LIBRARY INTERNAL STATE`);
  L.push(`${'═'.repeat(50)}`);
  L.push(JSON.stringify(libraries || {}, null, 2));

  // ── CSS Custom Properties ──
  const props = cssData.customProperties || {};
  L.push(`\n\n${'═'.repeat(50)}`);
  L.push(`CSS CUSTOM PROPERTIES (${Object.keys(props).length} variables)`);
  L.push(`${'═'.repeat(50)}`);

  const groups = { colors: {}, backgrounds: {}, animation: {}, typography: {}, spacing: {}, radius: {}, shadow: {}, other: {} };
  Object.entries(props).forEach(([k, v]) => {
    const kl = k.toLowerCase();
    if (kl.includes('color') || kl.includes('text') || kl.includes('border') || String(v).match(/^#|^rgb|^hsl/)) groups.colors[k] = v;
    else if (kl.includes('bg') || kl.includes('background') || kl.includes('surface')) groups.backgrounds[k] = v;
    else if (kl.includes('ease') || kl.includes('duration') || kl.includes('delay') || kl.includes('timing')) groups.animation[k] = v;
    else if (kl.includes('font') || kl.includes('text') || kl.includes('line') || kl.includes('letter')) groups.typography[k] = v;
    else if (kl.includes('space') || kl.includes('gap') || kl.includes('padding') || kl.includes('margin')) groups.spacing[k] = v;
    else if (kl.includes('radius') || kl.includes('rounded')) groups.radius[k] = v;
    else if (kl.includes('shadow')) groups.shadow[k] = v;
    else groups.other[k] = v;
  });

  Object.entries(groups).forEach(([name, vals]) => {
    if (!Object.keys(vals).length) return;
    L.push(`\n/* ${name.toUpperCase()} */`);
    Object.entries(vals).forEach(([k, v]) => L.push(`${k}: ${v};`));
  });

  // ── @keyframes ──
  if (cssData.keyframes?.length) {
    L.push(`\n\n${'═'.repeat(50)}`);
    L.push(`@KEYFRAMES (${cssData.keyframes.length} definitions)`);
    L.push(`${'═'.repeat(50)}`);
    cssData.keyframes.forEach(kf => L.push(`\n${kf}`));
  }

  // ── Computed Styles ──
  L.push(`\n\n${'═'.repeat(50)}`);
  L.push(`COMPUTED STYLES — KEY ELEMENTS`);
  L.push(`${'═'.repeat(50)}`);
  Object.entries(cssData.computedStyles || {}).forEach(([el, styles]) => {
    const clean = Object.fromEntries(Object.entries(styles).filter(([, v]) => v !== undefined && v !== ''));
    if (Object.keys(clean).length < 3) return;
    L.push(`\n[${el.toUpperCase()}]`);
    Object.entries(clean).forEach(([k, v]) => L.push(`  ${k}: ${v}`));
  });

  // ── Typography ──
  L.push(`\n\n${'═'.repeat(50)}`);
  L.push(`TYPOGRAPHY HEADING SCALE`);
  L.push(`${'═'.repeat(50)}`);
  Object.entries(designData.headingSizes || {}).forEach(([tag, s]) => {
    L.push(`\n[${tag.toUpperCase()}]`);
    Object.entries(s).forEach(([k, v]) => { if (v) L.push(`  ${k}: ${v}`); });
  });

  // ── Fonts ──
  L.push(`\n\n${'═'.repeat(50)}`);
  L.push(`FONTS`);
  L.push(`${'═'.repeat(50)}`);
  L.push(`Custom families: ${cssData.fontFamiliesUsed?.join(', ') || 'system only'}`);
  if (cssData.googleFontsLinks?.length) cssData.googleFontsLinks.forEach(l => L.push(`Google Fonts: ${l}`));

  // ── Layout ──
  L.push(`\n\n${'═'.repeat(50)}`);
  L.push(`LAYOUT`);
  L.push(`${'═'.repeat(50)}`);
  L.push(`Page height: ${designData.pageHeight}px | Viewport: ${designData.viewportWidth}px`);
  L.push(`Sections: ${designData.totalSectionCount}`);
  L.push(`Sticky: ${JSON.stringify(designData.stickyElements)}`);

  // ── DOM ──
  L.push(`\n\n${'═'.repeat(50)}`);
  L.push(`DOM FEATURES`);
  L.push(`${'═'.repeat(50)}`);
  L.push(JSON.stringify(domStructure, null, 2));

  return L.join('\n');
}
