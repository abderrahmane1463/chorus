import type { CSSProperties, ReactNode } from 'react';
import { assetUrl, brandingTokens, templateOf } from '@/lib/branding/templates';
import { cn } from '@/lib/utils/cn';
import type { EventBranding } from '@/types/branding';

/**
 * Dresses the whole page in an event's design.
 *
 * Written as a style sheet rather than as a wrapper element, so it reaches
 * everything on the page: the body behind the content, and menus and toasts
 * that are drawn outside it. It lives in the page, so it goes when the
 * viewer leaves for a page that is not this event's.
 *
 * Safe to write out: every value is either a constant from a template or a
 * colour that has passed the six-hex-digit check in `brandingTokens`.
 */
export function BrandStyle({ branding }: { branding: EventBranding | null }) {
  if (!branding) return null;

  const tokens = Object.entries(brandingTokens(branding))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
  const mode = templateOf(branding).mode;

  // Both selectors, so the design holds whichever theme the viewer's device
  // asked for.
  const css = `html:root,html.dark{${tokens};color-scheme:${mode}}`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

/** The same design applied to one element, for the editor's preview. */
export function brandingStyle(branding: EventBranding): CSSProperties {
  return {
    ...brandingTokens(branding),
    colorScheme: templateOf(branding).mode,
  } as CSSProperties;
}

/**
 * An uploaded logo at a given height.
 *
 * A plain <img>: the file is already sized for its use and served with a
 * permanent cache, so there is nothing for an image optimiser to add.
 */
function LogoImage({
  assetId,
  plate,
  className,
  alt,
}: {
  assetId: string;
  plate: boolean;
  className?: string;
  alt: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={assetUrl(assetId)}
      alt={alt}
      className={cn(
        'w-auto max-w-full object-contain',
        // For marks drawn in dark ink, which would vanish on a dark page.
        plate && 'rounded-md bg-white p-1.5',
        className,
      )}
    />
  );
}

/** The event's logo, or whatever is given as the fallback when it has none. */
export function BrandLogo({
  branding,
  title,
  className,
  fallback,
}: {
  branding: EventBranding | null;
  /** The event's name, read out in place of the image. */
  title: string;
  className?: string;
  fallback: ReactNode;
}) {
  if (!branding?.logoId) return <>{fallback}</>;

  return (
    <LogoImage
      assetId={branding.logoId}
      plate={branding.logoPlate}
      alt={title}
      className={className}
    />
  );
}

/** Partner and sponsor logos in a row. Renders nothing when there are none. */
export function PartnerLogos({
  branding,
  className,
  logoClassName,
}: {
  branding: EventBranding | null;
  className?: string;
  logoClassName?: string;
}) {
  if (!branding || branding.partnerIds.length === 0) return null;

  return (
    // Logos are pictures, not a sentence: their order must not mirror.
    <ul dir="ltr" className={cn('flex flex-wrap items-center gap-x-6 gap-y-3', className)}>
      {branding.partnerIds.map((id) => (
        <li key={id}>
          <LogoImage
            assetId={id}
            plate={branding.partnerPlate}
            // Decorative here: a partner's name is in the mark itself.
            alt=""
            className={cn('h-10', logoClassName)}
          />
        </li>
      ))}
    </ul>
  );
}
