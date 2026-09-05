import Link from 'next/link';
import { notFound } from 'next/navigation';
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
import { pluralize } from '@/lib/utils/format';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;
  const event = await getEventForOwner(eventId, user.id);
  return { title: event ? `${event.title} analytics` : 'Analytics' };
}

function formatRange(first: Date | null, last: Date | null): string | null {
  if (!first || !last) return null;
  const sameDay = first.toDateString() === last.toDateString();
  const date = first.toLocaleDateString();
  const from = first.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const to = last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `${date}, ${from} – ${to}` : `${first.toLocaleString()} – ${last.toLocaleString()}`;
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

  const analytics = await getEventAnalytics(event.id);
  const range = formatRange(analytics.firstResponseAt, analytics.lastResponseAt);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
      <Link
        href={`/dashboard/events/${event.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to interactions
      </Link>

      <PageHeader
        title={`${event.title} analytics`}
        description={range ?? 'No activity recorded yet.'}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <a href={`/api/events/${event.id}/export?dataset=responses`}>
                <Download />
                Responses CSV
              </a>
            </Button>
            <Button variant="secondary" asChild>
              <a href={`/api/events/${event.id}/export?dataset=questions`}>
                <Download />
                Questions CSV
              </a>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Participants" value={analytics.totals.participants} icon={Users} />
        <StatCard
          label="Participation"
          value={`${analytics.participationRate}%`}
          icon={Percent}
        />
        <StatCard label="Responses" value={analytics.totals.responses} icon={MessageSquare} />
        <StatCard label="Questions" value={analytics.totals.questions} icon={MessagesSquare} />
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {analytics.totals.responded} of {pluralize(analytics.totals.participants, 'participant')}{' '}
        answered at least once · {pluralize(analytics.totals.questionVotes, 'upvote')} on
        questions
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Responses over time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsesOverTime data={analytics.timeline} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Responses by interaction</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsesByInteraction
              data={analytics.perInteraction.map((item) => ({
                title: item.title || 'Untitled',
                responses: item.responseCount,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">Results by interaction</h2>

        {analytics.perInteraction.length === 0 ? (
          <EmptyState
            title="No interactions yet"
            description="Add a poll or a word cloud and its results appear here."
          />
        ) : (
          <div className="space-y-4">
            {analytics.perInteraction.map((item) => {
              const meta = getInteractionMeta(item.type);
              return (
                <Card key={item.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{item.title || 'Untitled'}</CardTitle>
                      <Badge>{meta?.name ?? item.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.questionCount !== undefined
                        ? pluralize(item.questionCount, 'question')
                        : pluralize(item.responseCount, 'response')}{' '}
                      from {pluralize(item.participantCount, 'participant')}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {item.children ? (
                      <div className="space-y-8">
                        {item.children.map((child) => (
                          <div key={child.id}>
                            <h3 className="mb-3 font-medium">
                              {child.title || 'Untitled question'}
                            </h3>
                            <ResultsView results={child.results} />
                          </div>
                        ))}
                      </div>
                    ) : item.questionCount !== undefined ? (
                      <p className="text-sm text-muted-foreground">
                        Questions and upvotes are listed below.
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
          <h2 className="mb-4 text-lg font-semibold">Quizzes</h2>
          <div className="space-y-4">
            {analytics.quizzes.map((quiz) => (
              <Card key={quiz.id}>
                <CardHeader>
                  <CardTitle>{quiz.title || 'Untitled quiz'}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {pluralize(quiz.leaderboard.length, 'player')}
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
          <h2 className="mb-4 text-lg font-semibold">Most upvoted questions</h2>
          <Card>
            <CardContent className="pt-5">
              <ol className="space-y-3">
                {analytics.topQuestions.map((question) => (
                  <li key={question.id} className="flex gap-4">
                    <span className="w-8 shrink-0 text-right font-semibold tabular-nums text-primary">
                      {question.votes}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block">{question.text}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {question.status}
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
