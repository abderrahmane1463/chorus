import type { BrandTemplateId, EventBranding } from '@/types/branding';

/**
 * The palettes an event can wear, and how one of them plus the event's own
 * colour becomes the full set of design tokens.
 *
 * Every screen is drawn from the CSS variables in `app/globals.css`. Branding
 * an event means handing the audience's pages a different value for each, so
 * nothing downstream needs to know a brand exists.
 */

type Surfaces = {
  background: string;
  foreground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  subtle: string;
  border: string;
  input: string;
};

export type BrandTemplate = {
  id: BrandTemplateId;
  /** Light or dark decides the status colours and how the accent is shaded. */
  mode: 'dark' | 'light';
  surfaces: Surfaces;
  /** Used when the event has not chosen a colour of its own. */
  accent: string;
};

export const BRAND_TEMPLATES: Record<BrandTemplateId, BrandTemplate> = {
  chorus: {
    id: 'chorus',
    mode: 'dark',
    accent: '#16a394',
    surfaces: {
      background: '#0a1215',
      foreground: '#e6edef',
      card: '#101c20',
      muted: '#16242a',
      mutedForeground: '#90a3aa',
      subtle: '#0d181c',
      border: '#1d2f36',
      input: '#24393f',
    },
  },
  midnight: {
    id: 'midnight',
    mode: 'dark',
    accent: '#7c93ff',
    surfaces: {
      background: '#0b1020',
      foreground: '#e8ecff',
      card: '#121a33',
      muted: '#1a2444',
      mutedForeground: '#9aa6d1',
      subtle: '#0e1530',
      border: '#26325c',
      input: '#2e3b69',
    },
  },
  ember: {
    id: 'ember',
    mode: 'dark',
    accent: '#f2762e',
    surfaces: {
      background: '#171210',
      foreground: '#f6ece4',
      card: '#211a16',
      muted: '#2c221d',
      mutedForeground: '#b9a596',
      subtle: '#1b1512',
      border: '#3d2f27',
      input: '#4a392f',
    },
  },
  forest: {
    id: 'forest',
    mode: 'dark',
    accent: '#3fbf7a',
    surfaces: {
      background: '#0c1510',
      foreground: '#e7f2ea',
      card: '#13201a',
      muted: '#1a2c23',
      mutedForeground: '#98b3a3',
      subtle: '#0f1a14',
      border: '#264033',
      input: '#2f4d3e',
    },
  },
  plum: {
    id: 'plum',
    mode: 'dark',
    accent: '#b57bff',
    surfaces: {
      background: '#150f1c',
      foreground: '#f1e9fa',
      card: '#1f162a',
      muted: '#2a1e38',
      mutedForeground: '#ad9cc4',
      subtle: '#191221',
      border: '#3b2b4f',
      input: '#47345e',
    },
  },
  paper: {
    id: 'paper',
    mode: 'light',
    accent: '#b4531a',
    surfaces: {
      background: '#fbf8f3',
      foreground: '#1f1a14',
      card: '#ffffff',
      muted: '#f1ece3',
      mutedForeground: '#6b6154',
      subtle: '#f6f2ea',
      border: '#e2dacd',
      input: '#d9d0c1',
    },
  },
  daylight: {
    id: 'daylight',
    mode: 'light',
    accent: '#2457e6',
    surfaces: {
      background: '#ffffff',
      foreground: '#0f1726',
      card: '#ffffff',
      muted: '#f3f5f9',
      mutedForeground: '#5a6579',
      subtle: '#f8f9fc',
      border: '#e1e6ee',
      input: '#d8dee8',
    },
  },
};

/** Colours that mean something (right, wrong, notice) keep their meaning per mode. */
const STATUS = {
  dark: {
    accent: '#e8912f',
    accentForeground: '#241604',
    accentSubtle: '#2b1f0f',
    success: '#2ea36e',
    successSubtle: '#10281e',
    destructive: '#e5534b',
    destructiveSubtle: '#2a1513',
  },
  light: {
    accent: '#d97316',
    accentForeground: '#ffffff',
    accentSubtle: '#fdf3e7',
    success: '#157f52',
    successSubtle: '#e9f6ef',
    destructive: '#c62828',
    destructiveSubtle: '#fdeceb',
  },
} as const;

export const DEFAULT_BRANDING: EventBranding = {
  template: 'chorus',
  accent: null,
  logoId: null,
  partnerIds: [],
  backgroundId: null,
  logoPlate: false,
  partnerPlate: false,
};

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColour(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((part) => Math.round(part).toString(16).padStart(2, '0')).join('');
}

/** `amount` of `b` mixed into `a`, from 0 (all a) to 1 (all b). */
function mix(a: string, b: string, amount: number): string {
  const from = toRgb(a);
  const to = toRgb(b);
  return toHex([0, 1, 2].map((i) => from[i] + (to[i] - from[i]) * amount) as Rgb);
}

/** Relative luminance, as WCAG defines it. */
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((part) => {
    const channel = part / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** The least a button or a coloured word needs to stand out from its page. */
const MIN_ACCENT_CONTRAST = 3;

/**
 * The event's colour, moved just far enough to be seen on this background.
 *
 * A host picks their brand colour without thinking about the template under
 * it: navy on a dark page would give buttons nobody can find. The colour is
 * nudged toward the text colour until it stands out, and left alone when it
 * already does.
 */
function visibleOn(accent: string, surfaces: Surfaces): string {
  let colour = accent;
  for (let step = 0; step < 10 && contrast(colour, surfaces.background) < MIN_ACCENT_CONTRAST; step++) {
    colour = mix(colour, surfaces.foreground, 0.12);
  }
  return colour;
}

/** The template an event uses, falling back to Chorus for anything unknown. */
export function templateOf(branding: Pick<EventBranding, 'template'>): BrandTemplate {
  return BRAND_TEMPLATES[branding.template] ?? BRAND_TEMPLATES.chorus;
}

/**
 * Every design token for a branded event, keyed by CSS variable name.
 *
 * Complete on purpose: the viewer's own light or dark preference must not
 * leak through, so no token is left to the page's default.
 */
export function brandingTokens(
  branding: Pick<EventBranding, 'template' | 'accent'>,
): Record<string, string> {
  const template = templateOf(branding);
  const { surfaces, mode } = template;
  const status = STATUS[mode];

  const chosen = isHexColour(branding.accent) ? branding.accent.toLowerCase() : template.accent;
  const primary = visibleOn(chosen, surfaces);

  const onPrimary =
    contrast(primary, '#ffffff') >= contrast(primary, '#0a0f12') ? '#ffffff' : '#0a0f12';

  return {
    '--background': surfaces.background,
    '--foreground': surfaces.foreground,
    '--card': surfaces.card,
    '--card-foreground': surfaces.foreground,
    '--muted': surfaces.muted,
    '--muted-foreground': surfaces.mutedForeground,
    '--subtle': surfaces.subtle,
    '--border': surfaces.border,
    '--input': surfaces.input,

    '--primary': primary,
    '--primary-hover': mode === 'dark' ? mix(primary, '#ffffff', 0.14) : mix(primary, '#000000', 0.16),
    '--primary-foreground': onPrimary,
    '--primary-subtle': mix(surfaces.background, primary, mode === 'dark' ? 0.18 : 0.1),
    '--ring': primary,

    '--accent': status.accent,
    '--accent-foreground': status.accentForeground,
    '--accent-subtle': status.accentSubtle,
    '--success': status.success,
    '--success-subtle': status.successSubtle,
    '--destructive': status.destructive,
    '--destructive-subtle': status.destructiveSubtle,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const assetId = (value: unknown): string | null =>
  typeof value === 'string' && UUID.test(value) ? value : null;

/**
 * A stored design, read defensively.
 *
 * What is in the column was validated when it was saved, but it is still
 * data: a template retired later, or a row edited by hand, must degrade to
 * the Chorus look rather than break the audience's page.
 */
export function readBranding(stored: unknown): EventBranding | null {
  if (!stored || typeof stored !== 'object') return null;
  const raw = stored as Record<string, unknown>;

  return {
    template:
      typeof raw.template === 'string' && raw.template in BRAND_TEMPLATES
        ? (raw.template as BrandTemplateId)
        : 'chorus',
    accent: isHexColour(raw.accent) ? raw.accent.toLowerCase() : null,
    logoId: assetId(raw.logoId),
    partnerIds: Array.isArray(raw.partnerIds)
      ? raw.partnerIds.map(assetId).filter((id): id is string => id !== null)
      : [],
    backgroundId: assetId(raw.backgroundId),
    logoPlate: raw.logoPlate === true,
    partnerPlate: raw.partnerPlate === true,
  };
}

/** Where an uploaded image is served from. */
export function assetUrl(assetId: string): string {
  return `/api/assets/${assetId}`;
}
