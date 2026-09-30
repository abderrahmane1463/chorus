/**
 * How an event looks to its audience. Stored as JSONB on the event; an event
 * with none looks like Chorus.
 *
 * Images are referenced by the id of a row in `event_assets`, never by URL, so
 * a saved design cannot point the audience's browsers at another site.
 */
export type EventBranding = {
  /** The base palette. See `lib/branding/templates.ts`. */
  template: BrandTemplateId;
  /** The event's own colour as `#rrggbb`, or null for the template's. */
  accent: string | null;
  /** The event's logo, shown in place of the Chorus mark. */
  logoId: string | null;
  /** Partner or sponsor logos, shown together on the big screen. */
  partnerIds: string[];
  /** A picture behind the big screen. */
  backgroundId: string | null;
  /** Put the event's logo on a white plate, for a mark drawn in dark ink. */
  logoPlate: boolean;
  /** The same for the partner logos, which rarely come in a light version. */
  partnerPlate: boolean;
};

export const BRAND_TEMPLATE_IDS = [
  'chorus',
  'midnight',
  'ember',
  'forest',
  'plum',
  'paper',
  'daylight',
] as const;

export type BrandTemplateId = (typeof BRAND_TEMPLATE_IDS)[number];

export const MAX_PARTNER_LOGOS = 6;
