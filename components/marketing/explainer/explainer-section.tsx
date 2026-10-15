import { getTranslations } from 'next-intl/server';
import { LazyExplainer } from './lazy-explainer';

/**
 * The explainer film as the homepage shows it: beside the headline on wide
 * screens, under it otherwise, with a one-line caption rather than a heading.
 */
export async function ExplainerSection() {
  const t = await getTranslations('explainer');

  return (
    <div>
      <LazyExplainer />
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{t('title')}.</span> {t('body')}
      </p>
    </div>
  );
}
