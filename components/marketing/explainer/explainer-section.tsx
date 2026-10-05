import { existsSync } from 'node:fs';
import path from 'node:path';
import { getTranslations } from 'next-intl/server';
import { LazyExplainer } from './lazy-explainer';

/** Where Sense Conseil's own logo goes; the first file found is used. */
const PARTNER_LOGOS = ['/brand/sense-conseil.svg', '/brand/sense-conseil.png'];

function findPartnerLogo() {
  return PARTNER_LOGOS.find((file) => existsSync(path.join(process.cwd(), 'public', file))) ?? null;
}

/** The explainer film with its heading, as the homepage shows it. */
export async function ExplainerSection() {
  const t = await getTranslations('explainer');

  return (
    <div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">{t('eyebrow')}</p>
          <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">{t('title')}</h2>
        </div>
        <p className="max-w-md text-muted-foreground">{t('body')}</p>
      </div>
      <LazyExplainer partnerLogo={findPartnerLogo()} />
    </div>
  );
}
