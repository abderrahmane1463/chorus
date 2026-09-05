import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarDays, Plus } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { listEventsForUser } from '@/lib/queries/dashboard';
import { PageHeader } from '@/components/dashboard/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { pluralize } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Events' };

const statusVariant = {
  live: 'success',
  draft: 'neutral',
  ended: 'outline',
  archived: 'outline',
} as const;

export default async function EventsPage() {
  const user = await requireUser();
  const events = await listEventsForUser(user.id);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
      <PageHeader
        title="Events"
        description={
          events.length === 0
            ? 'Everything you run lives here.'
            : `${events.length} ${events.length === 1 ? 'event' : 'events'}`
        }
        action={
          <Button asChild>
            <Link href="/dashboard/events/new">
              <Plus />
              New event
            </Link>
          </Button>
        }
      />

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No events yet"
          description="Create your first event and share the code with your audience."
          action={
            <Button asChild>
              <Link href="/dashboard/events/new">
                <Plus />
                New event
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id}>
              <Card className="transition-colors hover:border-primary">
                <Link
                  href={`/dashboard/events/${event.id}`}
                  className="block p-4 sm:flex sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{event.title}</p>
                      <Badge variant={statusVariant[event.status]}>
                        {event.status}
                      </Badge>
                    </div>
                    {event.description && (
                      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                        {event.description}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pluralize(event.interactionCount, 'interaction')} ·{' '}
                      {pluralize(event.participantCount, 'participant')} ·{' '}
                      {pluralize(event.questionCount, 'question')}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-4 sm:mt-0 sm:flex-col sm:items-end sm:gap-1">
                    <span className="font-mono text-sm">{event.eventCode}</span>
                    <span className="text-xs text-muted-foreground">
                      {event.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
