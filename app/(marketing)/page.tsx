import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  BarChart3,
  Cloud,
  LineChart,
  MessageSquare,
  Star,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExplainerSection } from '@/components/marketing/explainer/explainer-section';

// Keys, not copy: the icon and the order live here, the words in messages/.
// The three interactions people come for lead; the rest support them.
const mainFeatures = [
  { key: 'polls', icon: BarChart3 },
  { key: 'qa', icon: MessageSquare },
  { key: 'quizzes', icon: Trophy },
] as const;
const moreFeatures = [
  { key: 'wordClouds', icon: Cloud },
  { key: 'ratings', icon: Star },
  { key: 'analytics', icon: LineChart },
] as const;

const steps = ['create', 'share', 'open', 'watch'] as const;
const promises = ['noAccount', 'anyPhone', 'liveResults'] as const;
const useCases = ['allHands', 'conferences', 'classes', 'workshops'] as const;

export default async function LandingPage() {
  const t = await getTranslations('home');
  const tNav = await getTranslations('nav');

  return (
    <>
      <section className="mx-auto grid max-w-[1600px] items-center gap-14 px-5 pb-16 pt-16 sm:px-8 sm:pt-24 lg:px-12 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-16 xl:pt-20">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold leading-[1.1] text-balance sm:text-5xl lg:text-6xl">
            {t('hero.title')}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            {t('hero.body')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/sign-up">{tNav('getStarted')}</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/join">{tNav('join')}</Link>
            </Button>
          </div>
        </div>

        <ExplainerSection />
      </section>

      <section className="border-y border-border bg-subtle">
        <div className="mx-auto grid max-w-[1600px] gap-8 px-5 sm:px-8 lg:px-12 py-10 sm:grid-cols-3">
          {promises.map((key) => (
            <div key={key}>
              <p className="font-medium">{t(`promises.${key}.title`)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`promises.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="product"
        className="mx-auto grid max-w-[1600px] scroll-mt-20 gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:px-12 lg:py-28"
      >
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="max-w-lg text-3xl font-semibold text-balance sm:text-4xl">
            {t('product.title')}
          </h2>
          <p className="mt-3 max-w-md text-muted-foreground">{t('product.body')}</p>
        </div>

        <div>
          <ul className="divide-y divide-border border-y border-border">
            {mainFeatures.map((feature) => (
              <li key={feature.key} className="flex gap-5 py-7 sm:gap-6">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                  <feature.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-lg font-semibold sm:text-xl">
                    {t(`features.${feature.key}.title`)}
                  </h3>
                  <p className="mt-1.5 max-w-prose leading-relaxed text-muted-foreground">
                    {t(`features.${feature.key}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <ul className="mt-8 grid gap-6 sm:grid-cols-3">
            {moreFeatures.map((feature) => (
              <li key={feature.key}>
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <feature.icon className="size-4 text-primary" aria-hidden />
                  {t(`features.${feature.key}.title`)}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t(`features.${feature.key}.body`)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border bg-subtle">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8 lg:px-12 py-20">
          <h2 className="text-3xl font-semibold sm:text-4xl">{t('how.title')}</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((key, index) => (
              <li key={key}>
                <span className="font-mono text-sm text-accent-ink">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 font-semibold">{t(`steps.${key}.title`)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {t(`steps.${key}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="use-cases" className="mx-auto max-w-[1600px] scroll-mt-20 px-5 sm:px-8 lg:px-12 py-20">
        <h2 className="text-3xl font-semibold sm:text-4xl">{t('useCases.title')}</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {useCases.map((key) => (
            <div key={key} className="rounded-lg border border-border p-6">
              <h3 className="font-semibold">{t(`useCases.${key}.title`)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {t(`useCases.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="scroll-mt-20 border-t border-border bg-subtle">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h2 className="text-3xl font-semibold sm:text-4xl">{t('pricing.title')}</h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            {t('pricing.body')}
          </p>
          <div className="mt-8">
            <Button size="lg" asChild>
              <Link href="/sign-up">{t('pricing.cta')}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
