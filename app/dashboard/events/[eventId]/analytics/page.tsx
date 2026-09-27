import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import {
  ArrowLeft,
  Download,
  MessageSquare,
  MessagesSquare,
  Percent,
  Users,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getEventForOwner } from '@/lib/queries/events';
import { getEventAnalytics } from '@/lib/queries/analytics';
import { getInteractionMeta } from '@/lib/interactions/registry';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { ResultsView } from '@/components/interactions/results-view';
import { Leaderboard } from '@/components/interactions/leaderboard';
import { EmptyState } from '@/components/shared/empty-state';
import {
  ResponsesByInteraction,
  ResponsesOverTime,
} from '@/components/analytics/lazy-charts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;
  const event = await getEventForOwner(eventId, user.id);
  const t = await getTranslations('eventAnalytics');
  const tList = await getTranslations('analytics');
  return {
    title: event ? t('metaTitle', { title: event.title }) : tList('title'),
  };
}

/** Formatted with the reader's calendar, digits and clock. */
async function formatRange(first: Date | null, last: Date | null) {
  if (!first || !last) return null;
  const format = await getFormatter();
  const sameDay = first.toDateString() === last.toDateString();

  if (sameDay) {
    const date = format.dateTime(first, { dateStyle: 'medium' });
    const from = format.dateTime(first, { timeStyle: 'short' });
    const to = format.dateTime(last, { timeStyle: 'short' });
    return `${date}, ${from} – ${to}`;
  }

  const style = { dateStyle: 'medium', timeStyle: 'short' } as const;
  return `${format.dateTime(first, style)} – ${format.dateTime(last, style)}`;
}

export default async function EventAnalyticsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;

  const event = await getEventForOwner(eventId, user.id);
  if (!event) notFound();

  const t = await getTranslations('eventAnalytics');
  const tTypes = await getTranslations('types');
  const tQuestionStatus = await getTranslations('questionStatus');

  const analytics = await getEventAnalytics(event.id);
  const range = await formatRange(analytics.firstResponseAt, analytics.lastResponseAt);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
      <Link
        href={`/dashboard/events/${event.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t('back')}
      </Link>

      <PageHeader
        title={t('metaTitle', { title: event.title })}
        description={range ?? t('noActivity')}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <a href={`/api/events/${event.id}/export?dataset=responses`}>
                <Download />
                {t('responsesCsv')}
              </a>
            </Button>
            <Button variant="secondary" asChild>
              <a href={`/api/events/${event.id}/export?dataset=questions`}>
                <Download />
                {t('questionsCsv')}
              </a>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('participants')}
          value={analytics.totals.participants}
          icon={Users}
        />
        <StatCard
          label={t('participation')}
          value={`${analytics.participationRate}%`}
          icon={Percent}
        />
        <StatCard
          label={t('responses')}
          value={analytics.totals.responses}
          icon={MessageSquare}
        />
        <StatCard
          label={t('questions')}
          value={analytics.totals.questions}
          icon={MessagesSquare}
        />
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {t('summary', {
          responded: analytics.totals.responded,
          participants: t('participantCount', { count: analytics.totals.participants }),
          upvotes: t('upvoteCount', { count: analytics.totals.questionVotes }),
        })}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('overTime')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsesOverTime data={analytics.timeline} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('byInteraction')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsesByInteraction
              data={analytics.perInteraction.map((item) => ({
                title: item.title || t('untitled'),
                responses: item.responseCount,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">{t('resultsBy')}</h2>

        {analytics.perInteraction.length === 0 ? (
          <EmptyState
            title={t('noneTitle')}
            description={t('noneBody')}
          />
        ) : (
          <div className="space-y-4">
            {analytics.perInteraction.map((item) => {
              const meta = getInteractionMeta(item.type);
              return (
                <Card key={item.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{item.title || t('untitled')}</CardTitle>
                      <Badge>{meta ? tTypes(`${meta.type}.name`) : item.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('fromParticipants', {
                        count:
                          item.questionCount !== undefined
                            ? t('questionCount', { count: item.questionCount })
                            : t('responseCount', { count: item.responseCount }),
                        participants: t('participantCount', {
                          count: item.participantCount,
                        }),
                      })}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {item.children ? (
                      <div className="space-y-8">
                        {item.children.map((child) => (
                          <div key={child.id}>
                            <h3 className="mb-3 font-medium">
                              {child.title || t('untitledQuestion')}
                            </h3>
                            <ResultsView results={child.results} />
                          </div>
                        ))}
                      </div>
                    ) : item.questionCount !== undefined ? (
                      <p className="text-sm text-muted-foreground">
                        {t('questionsBelow')}
                      </p>
                    ) : (
                      <ResultsView results={item.results} />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {analytics.quizzes.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">{t('quizzes')}</h2>
          <div className="space-y-4">
            {analytics.quizzes.map((quiz) => (
              <Card key={quiz.id}>
                <CardHeader>
                  <CardTitle>{quiz.title || t('untitledQuiz')}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t('playerCount', { count: quiz.leaderboard.length })}
                  </p>
                </CardHeader>
                <CardContent>
                  <Leaderboard rows={quiz.leaderboard} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {analytics.topQuestions.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">{t('topQuestions')}</h2>
          <Card>
            <CardContent className="pt-5">
              <ol className="space-y-3">
                {analytics.topQuestions.map((question) => (
                  <li key={question.id} className="flex gap-4">
                    <span className="w-8 shrink-0 text-end font-semibold tabular-nums text-primary">
                      {question.votes}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block">{question.text}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {tQuestionStatus(question.status)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
