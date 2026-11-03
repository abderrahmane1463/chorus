import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { getFormatter, getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { interactions, participants, questions } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { getEventForOwner } from '@/lib/queries/events';
import { PrintButton } from '@/components/present/print-button';
import { csvFilename } from '@/lib/utils/csv';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const user = await requireUser();
  const { eventId } = await params;
  const event = await getEventForOwner(eventId, user.id);
  const t = await getTranslations('archive');
  return { title: event ? t('metaTitle', { title: event.title }) : t('metaFallback') };
}

/**
 * Every message the room saw on a Q&A, laid out to print or save as a PDF:
 * an archive the host hands on after the event. Only what was approved for
 * the screen is here; pending and hidden messages never were public.
 */
export default async function ArchivePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;
  const event = await getEventForOwner(eventId, user.id);
  if (!event) notFound();

  const t = await getTranslations('archive');
  const format = await getFormatter();

  const rows = await db
    .select({
      id: questions.id,
      interactionId: interactions.id,
      interaction: interactions.title,
      text: questions.text,
      isAnonymous: questions.isAnonymous,
      authorName: participants.displayName,
      createdAt: questions.createdAt,
    })
    .from(questions)
    .innerJoin(interactions, eq(interactions.id, questions.interactionId))
    .leftJoin(participants, eq(participants.id, questions.participantId))
    .where(
      and(eq(questions.eventId, event.id), inArray(questions.status, ['approved', 'answered'])),
    )
    .orderBy(asc(interactions.position), asc(questions.createdAt));

  // Grouped under the question each message answered, in the event's order.
  const sections: { id: string; title: string; messages: typeof rows }[] = [];
  for (const row of rows) {
    const last = sections.at(-1);
    if (last?.id === row.interactionId) last.messages.push(row);
    else sections.push({ id: row.interactionId, title: row.interaction, messages: [row] });
  }

  return (
    // Paper is white whatever the screen's theme, so the archive is too.
    <div className="min-h-dvh bg-white text-zinc-900 print:min-h-0">
      <style>{`@page { size: A4; margin: 14mm; } @media print { html, body { background: #fff !important; } }`}</style>

      <div className="mx-auto max-w-4xl px-6 py-10 print:max-w-none print:p-0">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4 print:hidden">
          <p className="max-w-xl text-sm text-zinc-600">{t('hint')}</p>
          <PrintButton
            label={t('print')}
            busyLabel={t('printing')}
            failedLabel={t('printFailed')}
            filename={`${csvFilename(event.title, 'archive').replace(/\.csv$/, '')}.pdf`}
            targetId="archive"
          />
        </div>

        <div id="archive">
        <header data-pdf-block="full" className="border-b border-zinc-300 pb-6">
          <h1 className="text-3xl font-semibold text-balance">{event.title}</h1>
          <p className="mt-2 text-zinc-600">
            {t('summary', {
              count: rows.length,
              date: format.dateTime(new Date(), { dateStyle: 'long' }),
            })}
          </p>
        </header>

        {sections.length === 0 ? (
          <p className="mt-10 text-lg text-zinc-600">{t('empty')}</p>
        ) : (
          sections.map((section) => (
            <section key={section.id} className="mt-10 break-before-auto">
              <div data-pdf-block="full">
                <h2 className="text-xl font-semibold text-balance">{section.title}</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {t('count', { count: section.messages.length })}
                </p>
              </div>
              <div className="mt-5 columns-2 gap-4 print:columns-2">
                {section.messages.map((message) => (
                  <figure
                    key={message.id}
                    data-pdf-block="card"
                    className="mb-4 break-inside-avoid rounded-lg border border-zinc-300 p-4"
                  >
                    <blockquote
                      dir="auto"
                      className="whitespace-pre-line text-base leading-relaxed [overflow-wrap:anywhere]"
                    >
                      {message.text}
                    </blockquote>
                    <figcaption className="mt-3 flex justify-between gap-3 text-xs text-zinc-500">
                      <span dir="auto">
                        {message.isAnonymous
                          ? t('anonymous')
                          : (message.authorName ?? t('anonymous'))}
                      </span>
                      <span>{format.dateTime(message.createdAt, { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ))
        )}

        <footer data-pdf-block="full" className="mt-12 border-t border-zinc-300 pt-4 text-xs text-zinc-500">
          {t('footer')}
        </footer>
        </div>
      </div>
    </div>
  );
}
