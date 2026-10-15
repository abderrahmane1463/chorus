import { getFormatter, getTranslations } from 'next-intl/server';
import { Check, MessageSquare, MessagesSquare, Percent, Users } from 'lucide-react';
import type { EventAnalytics } from '@/lib/queries/analytics';
import { getInteractionMeta } from '@/lib/interactions/registry';
import { StatCard } from '@/components/dashboard/stat-card';
import { ResultsView } from '@/components/interactions/results-view';
import { Leaderboard } from '@/components/interactions/leaderboard';
import { EmptyState } from '@/components/shared/empty-state';
import { ResponsesByInteraction, ResponsesOverTime } from '@/components/analytics/lazy-charts';
import { tileFor } from '@/components/quiz/answer-tiles';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

import type { ReportSection } from './sections';

const percent = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 100));

/**
 * An event's report: who took part and how, the Q&A, every interaction's
 * results, and every quiz question by question. The same report shows in the
 * host's statistics and behind a shared link, with the sections chosen.
 */
export async function AnalyticsReport({
  analytics,
  sections,
}: {
  analytics: EventAnalytics;
  sections: readonly ReportSection[];
}) {
  const show = new Set(sections);
  return (
    <div className="space-y-10">
      {show.has('engagement') && <Engagement analytics={analytics} />}
      {show.has('qa') && <QaInsights analytics={analytics} />}
      {show.has('polls') && <PollResults analytics={analytics} />}
      {show.has('quizzes') && <QuizInsights analytics={analytics} />}
    </div>
  );
}

/** A share of the room, drawn as a ring. */
function Ring({ value, tone }: { value: number; tone: 'primary' | 'accent' | 'success' }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const color = { primary: 'var(--primary)', accent: 'var(--accent)', success: 'var(--success)' }[tone];
  return (
    <span className="relative flex size-16 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--muted)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
        />
      </svg>
      <span className="relative text-sm font-semibold tabular-nums">{value}%</span>
    </span>
  );
}

function EngagementCard({
  title,
  body,
  value,
  tone,
  details,
}: {
  title: string;
  body: string;
  value: number;
  tone: 'primary' | 'accent' | 'success';
  details: { label: string; value: string }[];
}) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
        <Ring value={value} tone={tone} />
      </div>
      <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
        {details.map((detail) => (
          <div key={detail.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{detail.label}</dt>
            <dd className="font-medium tabular-nums">{detail.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

async function Engagement({ analytics }: { analytics: EventAnalytics }) {
  const t = await getTranslations('eventAnalytics');
  const format = await getFormatter();
  const { engagement: e, totals } = analytics;
  const total = totals.participants;

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">{t('engagementTitle')}</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <EngagementCard
          title={t('engagedTitle')}
          body={t('engagedBody', { count: e.engaged, total })}
          value={percent(e.engaged, total)}
          tone="primary"
          details={[
            { label: t('pollVoters'), value: format.number(e.pollVoters) },
            { label: t('qaEngagedLabel'), value: format.number(e.qaEngaged) },
          ]}
        />
        <EngagementCard
          title={t('pollEngagementTitle')}
          body={t('pollEngagementBody', { count: e.pollVoters, total })}
          value={percent(e.pollVoters, total)}
          tone="success"
          details={[
            { label: t('pollVotes'), value: format.number(e.pollVotes) },
            { label: t('pollsAnswered'), value: format.number(e.pollsAnswered) },
            {
              label: t('averageVotes'),
              value: format.number(e.pollsAnswered === 0 ? 0 : Math.round(e.pollVotes / e.pollsAnswered)),
            },
          ]}
        />
        <EngagementCard
          title={t('qaEngagementTitle')}
          body={t('qaEngagementBody', { count: e.qaEngaged, total })}
          value={percent(e.qaEngaged, total)}
          tone="accent"
          details={[
            { label: t('qaAskers'), value: format.number(e.qaAskers) },
            { label: t('qaVoters'), value: format.number(e.qaVoters) },
            { label: t('upvotesLabel'), value: format.number(totals.questionVotes) },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('participants')} value={total} icon={Users} />
        <StatCard label={t('participation')} value={`${percent(e.engaged, total)}%`} icon={Percent} />
        <StatCard label={t('responses')} value={totals.responses} icon={MessageSquare} />
        <StatCard label={t('questions')} value={totals.questions} icon={MessagesSquare} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
    </section>
  );
}

async function QaInsights({ analytics }: { analytics: EventAnalytics }) {
  const t = await getTranslations('eventAnalytics');
  const tStatus = await getTranslations('questionStatus');
  const format = await getFormatter();
  const { engagement: e, totals } = analytics;
  if (totals.questions === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">{t('qaTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t('totalQuestions')}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{format.number(totals.questions)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t('anonymousRate')}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {percent(e.anonymousQuestions, totals.questions)}%
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t('namedAuthors')}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{format.number(e.namedAuthors)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">{t('answeredOpen')}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {format.number(e.answeredQuestions)}
            <span className="text-muted-foreground"> / {format.number(totals.questions - e.answeredQuestions)}</span>
          </p>
        </Card>
      </div>

      {analytics.topQuestions.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>{t('topQuestions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {analytics.topQuestions.map((question) => (
                <li key={question.id} className="flex gap-4">
                  <span className="w-8 shrink-0 text-end font-semibold tabular-nums text-primary">
                    {question.votes}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block [overflow-wrap:anywhere]">{question.text}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {tStatus(question.status)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

async function PollResults({ analytics }: { analytics: EventAnalytics }) {
  const t = await getTranslations('eventAnalytics');
  const tTypes = await getTranslations('types');
  const items = analytics.perInteraction.filter((item) => item.questionCount === undefined);

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">{t('resultsBy')}</h2>
      {items.length === 0 ? (
        <EmptyState title={t('noneTitle')} description={t('noneBody')} />
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
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
                      count: t('responseCount', { count: item.responseCount }),
                      participants: t('participantCount', { count: item.participantCount }),
                    })}
                  </p>
                </CardHeader>
                <CardContent>
                  {item.children ? (
                    <div className="space-y-8">
                      {item.children.map((child) => (
                        <div key={child.id}>
                          <h3 className="mb-3 font-medium">{child.title || t('untitledQuestion')}</h3>
                          <ResultsView results={child.results} />
                        </div>
                      ))}
                    </div>
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
  );
}

async function QuizInsights({ analytics }: { analytics: EventAnalytics }) {
  const t = await getTranslations('eventAnalytics');
  const format = await getFormatter();
  if (analytics.quizzes.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">{t('quizzes')}</h2>
      <div className="space-y-6">
        {analytics.quizzes.map((quiz) => (
          <Card key={quiz.id}>
            <CardHeader>
              <CardTitle>{quiz.title || t('untitledQuiz')}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('playerCount', { count: quiz.leaderboard.length })}
              </p>
            </CardHeader>
            <CardContent className="space-y-8">
              {quiz.questions.map((question, index) => (
                <div key={question.id}>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="font-medium">
                      <span className="text-muted-foreground">{t('quizQuestion', { number: index + 1 })} · </span>
                      {question.title || t('untitledQuestion')}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t('answerCount', { count: question.answers })}
                      {question.answers > 0 && (
                        <>
                          {' · '}
                          <span className="font-medium text-success">
                            {t('correctRate', { percent: percent(question.correct, question.answers) })}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {question.options.map((option, optionIndex) => {
                      const share = percent(option.picks, question.answers);
                      return (
                        <li key={option.id}>
                          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                            <span className={cn('flex items-center gap-1.5', option.isCorrect && 'font-medium')}>
                              {option.isCorrect && (
                                <Check className="size-4 text-success" aria-label={t('correctAnswer')} />
                              )}
                              {option.text}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {t('optionShare', { picks: format.number(option.picks), percent: share })}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn('h-full rounded-full', tileFor(optionIndex).chart, !option.isCorrect && 'opacity-60')}
                              style={{ width: `${share}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              <div>
                <h3 className="mb-3 font-medium">{t('leaderboardTitle')}</h3>
                <Leaderboard rows={quiz.leaderboard} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
