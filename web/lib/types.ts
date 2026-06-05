export interface ExtractionData {
  url: string;
  title: string;
  extractedAt: string;
  techStack: TechStack;
  cssData: CSSData;
  designData: DesignData;
  domStructure: DOMStructure;
  screenshots: Screenshot[];
  hoverCaptures?: HoverCapture[];
  animationEngine: AnimationEngine;
}

export interface AnimationEngine {
  loadSequence: AnimationSnapshot[];
  scrollAnimations: ScrollAnimation[];
  hoverTransitions: HoverTransition[];
  libraries: Record<string, any>;
  intersectionTriggers: IOTrigger[];
  domMutations: MutationEntry[];
  typewriterEffects: TypewriterEffect[];
  classTogglePatterns: ClassTogglePattern[];
}

export interface AnimationSnapshot {
  element: string;
  elapsed: number;
  playState: string;
  currentTime: number;
  timing: AnimationTiming;
  keyframes: any[];
}

export interface ScrollAnimation {
  triggeredAtScrollY: number;
  element: string;
  elementTag?: string;
  elementId?: string;
  timing: AnimationTiming;
  keyframes: any[];
  currentTime: number;
}

export interface HoverTransition {
  label: string;
  restingStyles: Record<string, string>;
  hoverStyles: Record<string, string>;
  animationsDetectedDuringHover: any[];
  before: string;
  after: string;
}

export interface IOTrigger {
  tag: string;
  class: string;
  id: string | null;
  threshold: number;
  rootMargin: string;
  scrollY: number;
  t: number;
}

export interface MutationEntry {
  type: string;
  tag?: string;
  t: number;
}

export interface TypewriterEffect {
  element: string;
  intervalMs: number;
  characterCount: number;
  sample: { start: string; middle: string; end: string };
  startedAtMs: number;
}

export interface ClassTogglePattern {
  className: string;
  occurrences: number;
  scrollPositions: number[];
  elements: string[];
  firstToggleAt: number;
}

export interface AnimationTiming {
  duration: number;
  delay: number;
  easing: string;
  fill?: string;
  iterations?: number;
  direction?: string;
}

export interface TechStack {
  framework: string | null;
  tailwind: boolean;
  bootstrap: boolean;
  radix: boolean;
  animationLibraries: Record<string, any>;
}

export interface CSSData {
  customProperties: Record<string, string>;
  keyframes: string[];
  fontFaces: string[];
  transitions: string[];
  computedStyles: Record<string, Record<string, string | undefined>>;
  googleFontsLinks: string[];
  fontFamiliesUsed: string[];
}

export interface DesignData {
  pageHeight: number;
  viewportWidth: number;
  headingSizes: Record<string, any>;
  colorSamples: string[];
  bgSamples: string[];
  stickyElements: any[];
  totalSectionCount: number;
}

export interface DOMStructure {
  hasNav: boolean;
  hasHero: boolean;
  hasModal: boolean;
  hasCarousel: boolean;
  hasAccordion: boolean;
  hasForm: boolean;
  hasTabs: boolean;
  hasVideoBackground: boolean;
  hasCustomCursor: boolean;
  sectionCount: number;
  dataAttributes: string[];
}

export interface Screenshot {
  scrollPercent: number;
  scrollY: number;
  data: string;
}

export interface HoverCapture {
  label: string;
  before: string;
  after: string;
}

export type StreamEvent =
  | { type: 'stage'; stage: string; message: string }
  | { type: 'text'; text: string }
  | { type: 'done'; siteName: string }
  | { type: 'error'; message: string };
