export interface ExtractionData {
  url: string;
  title: string;
  extractedAt: string;
  techStack: TechStack;
  cssData: CSSData;
  designData: DesignData;
  domStructure: DOMStructure;
  screenshots: Screenshot[];
  hoverCaptures: HoverCapture[];
}

export interface TechStack {
  framework: string | null;
  gsap: boolean;
  gsapVersion: string | null;
  scrollTrigger: boolean;
  framerMotion: boolean;
  aos: boolean;
  aosElements: number;
  scrollReveal: boolean;
  motionOne: boolean;
  lottie: boolean;
  anime: boolean;
  lenis: boolean;
  locomotive: boolean;
  nativeSmoothScroll: boolean;
  tailwind: boolean;
  bootstrap: boolean;
  radix: boolean;
  headlessui: boolean;
  webgl: boolean;
  threeJs: boolean;
  spline: boolean;
  particles: boolean;
  splitType: boolean;
  customCursor: boolean;
  magneticElements: number;
  videoBackground: boolean;
  canvasAnimations: number;
  scriptSources: string[];
}

export interface CSSData {
  customProperties: Record<string, string>;
  keyframes: string[];
  fontFaces: string[];
  transitions: string[];
  animationNames: string[];
  computedStyles: Record<string, Record<string, string | undefined>>;
  googleFontsLinks: string[];
  fontFamiliesUsed: string[];
  mediaQueryBreakpoints: string[];
}

export interface DesignData {
  pageHeight: number;
  pageWidth: number;
  viewportWidth: number;
  containers: Container[];
  sections: Section[];
  hasParallax: boolean;
  stickyElements: StickyElement[];
  colorSamples: string[];
  bgSamples: string[];
  headingSizes: Record<string, HeadingStyle>;
  cursorElements: unknown[];
  totalSectionCount: number;
}

export interface DOMStructure {
  hasNav: boolean;
  hasFooter: boolean;
  hasHero: boolean;
  hasModal: boolean;
  hasCarousel: boolean;
  hasAccordion: boolean;
  hasForm: boolean;
  hasTabs: boolean;
  hasVideoBackground: boolean;
  sectionCount: number;
  totalImages: number;
  hasSVGIllustrations: boolean;
  hasInlineAnimation: number;
  dataAttributes: string[];
}

export interface Screenshot {
  scrollPercent: number;
  scrollY: number;
  data: string; // base64 JPEG
}

export interface HoverCapture {
  label: string;
  before: string; // base64 JPEG
  after: string;  // base64 JPEG
}

interface Container {
  tag: string;
  class: string;
  maxWidth: string;
  width: number;
}

interface Section {
  index: number;
  height: number;
  paddingTop: string;
  paddingBottom: string;
  backgroundColor: string;
  backgroundImage: string | null;
  hasAnimation: boolean;
  hasTransition: boolean;
}

interface StickyElement {
  tag: string;
  class: string;
  position: string;
}

interface HeadingStyle {
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  fontFamily: string;
  color: string;
  textTransform: string;
}

// ─── Streaming event types ────────────────────────────────────────────────────

export type StreamEvent =
  | { type: 'stage'; stage: string; message: string }
  | { type: 'text'; text: string }
  | { type: 'done'; siteName: string }
  | { type: 'error'; message: string };
