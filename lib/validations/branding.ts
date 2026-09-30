import { z } from 'zod';
import { BRAND_TEMPLATE_IDS, MAX_PARTNER_LOGOS } from '@/types/branding';

/**
 * A saved design. Strict on purpose: these values are written into a style
 * sheet served to the audience, so a colour is six hex digits and nothing
 * else, and an image is an id and never an address.
 */
export const saveBrandingSchema = z.object({
  eventId: z.string().uuid(),
  template: z.enum(BRAND_TEMPLATE_IDS),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  logoId: z.string().uuid().nullable(),
  partnerIds: z.array(z.string().uuid()).max(MAX_PARTNER_LOGOS),
  backgroundId: z.string().uuid().nullable(),
  logoPlate: z.boolean(),
  partnerPlate: z.boolean(),
});

export type SaveBrandingInput = z.infer<typeof saveBrandingSchema>;

export const ASSET_KINDS = ['logo', 'partner', 'background'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

/** What the browser resizes to before uploading, and the server's ceiling. */
export const ASSET_LIMITS: Record<AssetKind, { maxEdge: number; maxBytes: number }> = {
  logo: { maxEdge: 640, maxBytes: 400_000 },
  partner: { maxEdge: 480, maxBytes: 300_000 },
  background: { maxEdge: 1920, maxBytes: 1_500_000 },
};

/** Uploads waiting to be saved are kept, up to this many per event. */
export const MAX_ASSETS_PER_EVENT = 40;
