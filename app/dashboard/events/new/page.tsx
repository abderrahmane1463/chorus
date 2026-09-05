import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { EventForm } from '@/components/dashboard/event-form';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = { title: 'New event' };

export default async function NewEventPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-xl px-5 py-8 lg:px-8">
      <PageHeader
        title="Create an event"
        description="You will get a join code as soon as it is created."
      />
      <Card>
        <CardContent className="pt-5">
          <EventForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
