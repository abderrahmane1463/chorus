import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getEventForOwner } from '@/lib/queries/events';
import { DesignEditor } from '@/components/dashboard/design-editor';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;
  const event = await getEventForOwner(eventId, user.id);
  const t = await getTranslations('design');
  return { title: event ? t('metaTitle', { title: event.title }) : t('title') };
}

/**
 * Where a host chooses how their event looks.
 *
 * Reached two ways: as the second step of creating an event (`?new=1`), where
 * it can be skipped, and later from the event's page.
 */
export default async function EventDesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;
  const isNew = (await searchParams).new === '1';

  const event = await getEventForOwner(eventId, user.id);
  if (!event) notFound();

  const t = await getTranslations('design');

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
      {!isNew && (
        <Link
          href={`/dashboard/events/${event.id}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t('back')}
        </Link>
      )}

      <div className="mb-8">
        {isNew && <p className="mb-1 text-sm font-medium text-primary">{t('step')}</p>}
        <h1 className="text-2xl font-semibold">{isNew ? t('stepTitle') : t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isNew ? t('stepBody') : t('description', { title: event.title })}
        </p>
      </div>

      <DesignEditor
        eventId={event.id}
        eventTitle={event.title}
        eventCode={event.eventCode}
        initial={event.branding}
        isNew={isNew}
      />
    </div>
  );
}
