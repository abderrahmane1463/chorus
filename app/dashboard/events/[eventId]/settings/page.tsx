import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getEventForOwner } from '@/lib/queries/events';
import { EventForm } from '@/components/dashboard/event-form';
import { EventStatusControl } from '@/components/dashboard/event-status-control';
import { CopyButton } from '@/components/dashboard/copy-button';
import { DangerZone } from '@/components/dashboard/danger-zone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;
  const event = await getEventForOwner(eventId, user.id);
  return { title: event ? `${event.title} settings` : 'Event settings' };
}

const statusVariant = {
  live: 'success',
  draft: 'neutral',
  ended: 'outline',
  archived: 'outline',
} as const;

export default async function EventSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const user = await requireUser();
  const { eventId } = await params;

  const event = await getEventForOwner(eventId, user.id);
  if (!event) notFound();

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const joinUrl = `${origin}/event/${event.eventCode}`;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 lg:px-8">
      <Link
        href={`/dashboard/events/${event.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to interactions
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{event.title}</h1>
            <Badge variant={statusVariant[event.status]}>{event.status}</Badge>
          </div>
          {event.description && (
            <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
          )}
        </div>
        <EventStatusControl eventId={event.id} status={event.status} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Join details</CardTitle>
          <CardDescription>
            Put the code on screen. Anyone with it can join without an account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg bg-muted px-4 py-2 font-mono text-2xl font-semibold tracking-widest">
              {event.eventCode}
            </span>
            <CopyButton
              value={event.eventCode}
              label="Copy code"
              successMessage="Event code copied"
            />
            <CopyButton
              value={joinUrl}
              label="Copy join link"
              successMessage="Join link copied"
            />
            <Button variant="ghost" size="sm" asChild>
              <a href={joinUrl} target="_blank" rel="noreferrer">
                <ExternalLink />
                Open participant view
              </a>
            </Button>
          </div>

          <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
            {[
              ['Interactions', event.interactionCount],
              ['Participants', event.participantCount],
              ['Responses', event.responseCount],
              ['Questions', event.questionCount],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm
            mode="edit"
            eventId={event.id}
            defaultValues={{
              title: event.title,
              description: event.description ?? '',
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <DangerZone eventId={event.id} title={event.title} />
        </CardContent>
      </Card>
    </div>
  );
}
