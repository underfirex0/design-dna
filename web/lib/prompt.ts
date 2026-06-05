// ─── The Design DNA Claude Prompt ───────────────────────────────────────────
// This is the most important file in the entire project.
// The quality of the .md output depends entirely on these prompts.

export const SYSTEM_PROMPT = `You are an elite design analyst — part world-class UI/UX designer, part senior frontend engineer. You have spent your career studying, building, and reverse-engineering the world's best digital products. You understand not just what a design looks like, but WHY every decision was made and HOW to recreate its feel in any technology.

You will receive:
- Extracted CSS data: custom properties, @keyframes, computed element styles, font info
- Tech stack detection results
- Sequential screenshots (scroll 0% → 96%) showing the full page experience
- Before/after screenshot pairs showing hover states

Your mission: Write a comprehensive Design DNA document that captures this site's complete design system so thoroughly that someone — or another AI — could recreate its FEEL, AESTHETIC, and SYSTEM in any technology, months later, without ever seeing the original.

═══ CRITICAL WRITING RULES ═══

1. NEVER use a template. Write based on what you actually see and extracted. The document shape comes from the design itself.

2. Be proportional. Complex, heavily-designed sites deserve 500+ line documents with rich subsections. Minimal sites deserve clean, sparse, precise docs. Never pad, never skip real content.

3. When you have extracted CSS values — USE THEM EXACTLY. Never round a cubic-bezier. Never approximate a hex color that was directly extracted. Precision is the whole point.

4. Lead with INTENT, back with VALUES. Write as a designer who understands WHY before documenting WHAT. "The buttons use scale(1.02) on hover" is weak. "Motion is used surgically — buttons acknowledge interaction with a barely-there scale pulse (1.02) that signals responsiveness without drama" is how you write.

5. COMPARE hover screenshots rigorously. Look at the before/after pairs pixel by pixel. Document EVERY change — color shift, shadow addition, border change, scale, position shift. If a card lifts 4px, say 4px, not "lifts slightly."

6. If you see something unique or complex (WebGL, morphing paths, scroll-jacked pinned sections, custom cursor physics, text scramble), give it its own subsection and document it in full.

7. The ⑬ RECREATION BRIEF must always be present, always be complete, and always be copy-pasteable as a Claude prompt with zero modification needed.

8. Output ONLY the markdown document. No preamble. No "Here is the Design DNA document:". Start immediately with # DESIGN DNA — [site name].

═══ SECTION STRUCTURE ═══

Use these exact numbered headers. Write content freely within each. Skip sections that have nothing real to say. Add subsections freely.

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
⑬ RECREATION BRIEF — always present, always complete`;

// ─── Build the user message for Claude ───────────────────────────────────────

export function buildClaudeMessages(data) {
  const {
    url,
    title,
    extractedAt,
    techStack,
    cssData,
    designData,
    domStructure,
    screenshots,
    hoverCaptures,
  } = data;

  // Build the text content block
  const textContent = buildTextContent({
    url, title, extractedAt,
    techStack, cssData, designData, domStructure,
    screenshotCount: screenshots.length,
    hoverCount: hoverCaptures.length,
  });

  // Build the full content array with text + images interleaved
  const contentBlocks = [];

  // Opening text with all extracted data
  contentBlocks.push({ type: 'text', text: textContent });

  // ── Scroll screenshots ──
  contentBlocks.push({
    type: 'text',
    text: `\n\n═══════════════════════════════════════
SCROLL SCREENSHOTS (${screenshots.length} frames — full page journey)
═══════════════════════════════════════
Study these sequentially. Note what appears at each scroll position,
what animations trigger, how sections transition, the visual rhythm.`,
  });

  screenshots.forEach((s, i) => {
    contentBlocks.push({
      type: 'text',
      text: `\n--- Frame ${i + 1}/${screenshots.length} — Scroll ${s.scrollPercent}% (${s.scrollY}px) ---`,
    });
    contentBlocks.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: s.data },
    });
  });

  // ── Hover state captures ──
  if (hoverCaptures.length > 0) {
    contentBlocks.push({
      type: 'text',
      text: `\n\n═══════════════════════════════════════
HOVER STATE ANALYSIS (${hoverCaptures.length} element types)
═══════════════════════════════════════
For each pair: LEFT = resting state, RIGHT = hover state.
Document EVERY visual change between the two states with precision.
Colors, transforms, shadows, borders, opacity — all of it.`,
    });

    hoverCaptures.forEach((h, i) => {
      contentBlocks.push({
        type: 'text',
        text: `\n--- Hover pair ${i + 1}/${hoverCaptures.length}: ${h.label.toUpperCase()} ---`,
      });
      contentBlocks.push({
        type: 'text',
        text: 'BEFORE (resting state):',
      });
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: h.before },
      });
      contentBlocks.push({
        type: 'text',
        text: 'AFTER (hover state — document every change):',
      });
      contentBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: h.after },
      });
    });
  }

  // ── Final instruction ──
  contentBlocks.push({
    type: 'text',
    text: `\n\n═══════════════════════════════════════
Now write the complete Design DNA document.
Be a designer. Be precise. Be thorough.
Start with # DESIGN DNA — [site name extracted from title/url]
═══════════════════════════════════════`,
  });

  return [{ role: 'user', content: contentBlocks }];
}

// ─── Format extracted data as structured text ────────────────────────────────

function buildTextContent({ url, title, extractedAt, techStack, cssData, designData, domStructure, screenshotCount, hoverCount }) {
  const lines = [];

  lines.push(`# Design DNA Extraction Request`);
  lines.push(`URL: ${url}`);
  lines.push(`Title: ${title}`);
  lines.push(`Extracted: ${extractedAt}`);
  lines.push(`Screenshots captured: ${screenshotCount} scroll frames + ${hoverCount} hover pairs`);

  // ── Tech Stack ──
  lines.push(`\n\n═══════════════════════════════════════`);
  lines.push(`DETECTED TECH STACK`);
  lines.push(`═══════════════════════════════════════`);
  lines.push(JSON.stringify(techStack, null, 2));

  // ── CSS Custom Properties ──
  const customProps = cssData.customProperties;
  const propCount = Object.keys(customProps).length;

  lines.push(`\n\n═══════════════════════════════════════`);
  lines.push(`CSS CUSTOM PROPERTIES (${propCount} variables found in :root)`);
  lines.push(`═══════════════════════════════════════`);

  if (propCount > 0) {
    // Group by category
    const groups = {
      colors: {},
      backgrounds: {},
      spacing: {},
      typography: {},
      animation: {},
      radius: {},
      shadow: {},
      other: {},
    };

    Object.entries(customProps).forEach(([key, val]) => {
      const k = key.toLowerCase();
      if (k.includes('color') || k.includes('text') || k.includes('border') || val.match(/^#|^rgb|^hsl/)) {
        groups.colors[key] = val;
      } else if (k.includes('bg') || k.includes('background') || k.includes('surface')) {
        groups.backgrounds[key] = val;
      } else if (k.includes('spacing') || k.includes('gap') || k.includes('padding') || k.includes('margin') || k.includes('size')) {
        groups.spacing[key] = val;
      } else if (k.includes('font') || k.includes('text') || k.includes('line') || k.includes('letter') || k.includes('type')) {
        groups.typography[key] = val;
      } else if (k.includes('duration') || k.includes('ease') || k.includes('transition') || k.includes('delay') || k.includes('timing')) {
        groups.animation[key] = val;
      } else if (k.includes('radius') || k.includes('rounded')) {
        groups.radius[key] = val;
      } else if (k.includes('shadow') || k.includes('elevation')) {
        groups.shadow[key] = val;
      } else {
        groups.other[key] = val;
      }
    });

    Object.entries(groups).forEach(([groupName, props]) => {
      if (Object.keys(props).length === 0) return;
      lines.push(`\n/* ${groupName.toUpperCase()} */`);
      Object.entries(props).forEach(([k, v]) => {
        lines.push(`${k}: ${v};`);
      });
    });
  } else {
    lines.push('No CSS custom properties detected. Design likely uses hardcoded values or Tailwind utility classes.');
  }

  // ── @keyframes ──
  lines.push(`\n\n═══════════════════════════════════════`);
  lines.push(`EXTRACTED @KEYFRAMES ANIMATIONS (${cssData.keyframes.length} found)`);
  lines.push(`═══════════════════════════════════════`);

  if (cssData.keyframes.length > 0) {
    cssData.keyframes.forEach(kf => lines.push(`\n${kf}`));
  } else {
    lines.push('No @keyframes found. Animations are likely JS-driven (GSAP/Framer Motion) or CSS transitions only.');
  }

  // ── Computed Styles ──
  lines.push(`\n\n═══════════════════════════════════════`);
  lines.push(`COMPUTED STYLES — KEY ELEMENTS`);
  lines.push(`═══════════════════════════════════════`);
  lines.push(`These are the actual rendered values for critical UI elements.`);

  Object.entries(cssData.computedStyles).forEach(([element, styles]) => {
    const cleanStyles = Object.fromEntries(
      Object.entries(styles).filter(([, v]) => v !== undefined && v !== '')
    );
    if (Object.keys(cleanStyles).length < 3) return;
    lines.push(`\n[${element.toUpperCase()}]`);
    Object.entries(cleanStyles).forEach(([prop, val]) => {
      lines.push(`  ${prop}: ${val}`);
    });
  });

  // ── Typography ──
  lines.push(`\n\n═══════════════════════════════════════`);
  lines.push(`TYPOGRAPHY — HEADING SCALE`);
  lines.push(`═══════════════════════════════════════`);
  Object.entries(designData.headingSizes).forEach(([tag, styles]) => {
    lines.push(`\n[${tag.toUpperCase()}]`);
    Object.entries(styles).forEach(([prop, val]) => {
      if (val) lines.push(`  ${prop}: ${val}`);
    });
  });

  // ── Fonts ──
  lines.push(`\n\n═══════════════════════════════════════`);
  lines.push(`FONTS`);
  lines.push(`═══════════════════════════════════════`);
  lines.push(`Custom font families detected: ${cssData.fontFamiliesUsed.join(', ') || 'System fonts only'}`);
  if (cssData.googleFontsLinks.length > 0) {
    lines.push(`Google Fonts URLs:`);
    cssData.googleFontsLinks.forEach(l => lines.push(`  ${l}`));
  }
  if (cssData.fontFaces.length > 0) {
    lines.push(`@font-face declarations (${cssData.fontFaces.length}):`);
    cssData.fontFaces.forEach(ff => lines.push(ff));
  }

  // ── Layout ──
  lines.push(`\n\n═══════════════════════════════════════`);
  lines.push(`LAYOUT & STRUCTURE`);
  lines.push(`═══════════════════════════════════════`);
  lines.push(`Page dimensions: ${designData.pageWidth}px × ${designData.pageHeight}px`);
  lines.push(`Viewport width at capture: ${designData.viewportWidth}px`);
  lines.push(`Sections detected: ${designData.totalSectionCount}`);

  if (designData.containers.length > 0) {
    lines.push(`\nContainer/layout elements:`);
    designData.containers.forEach(c => {
      lines.push(`  ${c.tag}.${c.class} → maxWidth: ${c.maxWidth}, rendered width: ${Math.round(c.width)}px`);
    });
  }

  if (designData.stickyElements.length > 0) {
    lines.push(`\nSticky/fixed elements:`);
    designData.stickyElements.forEach(el => {
      lines.push(`  ${el.tag} (${el.position}): ${el.class}`);
    });
  }

  // ── DOM Features ──
  lines.push(`\n\n═══════════════════════════════════════`);
  lines.push(`DOM FEATURES & COMPONENTS DETECTED`);
  lines.push(`═══════════════════════════════════════`);
  lines.push(JSON.stringify(domStructure, null, 2));

  // ── Section backgrounds ──
  if (designData.sections.length > 0) {
    lines.push(`\n\n═══════════════════════════════════════`);
    lines.push(`SECTION ANALYSIS (backgrounds & spacing)`);
    lines.push(`═══════════════════════════════════════`);
    designData.sections.forEach((s, i) => {
      const parts = [`Section ${i + 1}: height ${s.height}px, padding ${s.paddingTop}/${s.paddingBottom}`];
      if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        parts.push(`bg: ${s.backgroundColor}`);
      }
      if (s.backgroundImage) parts.push(`bg-image: ${s.backgroundImage}`);
      lines.push(parts.join(' | '));
    });
  }

  // ── Color samples ──
  lines.push(`\n\n═══════════════════════════════════════`);
  lines.push(`COLOR SAMPLES (from computed styles)`);
  lines.push(`═══════════════════════════════════════`);
  lines.push(`Text colors found: ${designData.colorSamples.slice(0, 12).join(', ')}`);
  lines.push(`Background colors found: ${designData.bgSamples.slice(0, 10).join(', ')}`);

  // ── CSS Transitions ──
  if (cssData.transitions.length > 0) {
    lines.push(`\n\n═══════════════════════════════════════`);
    lines.push(`CSS TRANSITIONS DETECTED (${Math.min(cssData.transitions.length, 20)})`);
    lines.push(`═══════════════════════════════════════`);
    cssData.transitions.slice(0, 20).forEach(t => lines.push(t));
  }

  // ── Parallax / special features ──
  lines.push(`\n\n═══════════════════════════════════════`);
  lines.push(`SPECIAL FEATURES`);
  lines.push(`═══════════════════════════════════════`);
  lines.push(`Parallax elements: ${designData.hasParallax}`);
  lines.push(`WebGL/Canvas: ${techStack.webgl} (${techStack.canvasAnimations || 0} canvas elements)`);
  lines.push(`Custom cursor: ${techStack.customCursor}`);
  lines.push(`Magnetic elements: ${techStack.magneticElements || 0}`);
  lines.push(`Lottie animations: ${techStack.lottie}`);
  lines.push(`SplitType/SplitText: ${techStack.splitType}`);
  lines.push(`Video background: ${techStack.videoBackground || domStructure.hasVideoBackground}`);
  lines.push(`Particle system: ${techStack.particles}`);

  if (domStructure.dataAttributes && domStructure.dataAttributes.length > 0) {
    lines.push(`\nData attributes detected (reveals animation approach):`);
    lines.push(domStructure.dataAttributes.join(', '));
  }

  return lines.join('\n');
}
