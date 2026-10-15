import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { connection } from 'next/server';
import { getFormatter, getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('privacy');
  return { title: t('metaTitle'), description: t('metaDescription') };
}

const LAST_UPDATED = new Date('2026-09-17T12:00:00Z');

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 ps-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * Written against the schema, not a template: every claim here should stay
 * true of what the database and cookies actually hold. Update it, in all three
 * languages, alongside any change to what Chorus collects.
 */
export default async function PrivacyPage() {
  // The contact address is deployment configuration, so read it per request
  // rather than from the build, which has no environment.
  await connection();
  const contact = process.env.PRIVACY_CONTACT_EMAIL;
  const t = await getTranslations('privacy');
  const format = await getFormatter();
  const list = (key: string) => t.raw(key) as string[];

  return (
    <article className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      <h1 className="text-4xl font-semibold text-balance">{t('title')}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {t('updated', { date: format.dateTime(LAST_UPDATED, { dateStyle: 'long' }) })}
      </p>

      <p className="mt-8 text-lg text-muted-foreground">{t('intro')}</p>

      <Section title={t('hostTitle')}>
        <p>{t.rich('hostStores', { b: (chunks) => <strong>{chunks}</strong> })}</p>
        <List items={list('hostList')} />
        <p>{t('hostContent')}</p>
      </Section>

      <Section title={t('joinTitle')}>
        <p>{t('joinId')}</p>
        <p>{t('joinStores')}</p>
        <List items={list('joinList')} />
        <p>{t('joinHost')}</p>
      </Section>

      <Section title={t('cookiesTitle')}>
        <p>{t('cookiesIntro')}</p>
        <List items={list('cookiesList')} />
        <p>{t('cookiesNone')}</p>
      </Section>

      <Section title={t('notTitle')}>
        <List items={list('notList')} />
      </Section>

      <Section title={t('whereTitle')}>
        <p>{t('whereBody')}</p>
        <p>{t('whereShare')}</p>
      </Section>

      <Section title={t('keepTitle')}>
        <p>{t('keepBody')}</p>
      </Section>

      <Section title={t('choicesTitle')}>
        <p>
          {t('choicesBody')}{' '}
          {contact
            ? t.rich('choicesEmail', {
                email: contact,
                link: (chunks) => (
                  <a href={`mailto:${contact}`} className="font-medium text-primary underline underline-offset-4 hover:decoration-2">
                    {chunks}
                  </a>
                ),
              })
            : t('choicesNoEmail')}
        </p>
        <p>{t('choicesGoogle')}</p>
      </Section>

      <Section title={t('changesTitle')}>
        <p>{t('changesBody')}</p>
      </Section>
    </article>
  );
}
