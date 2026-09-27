import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { EventForm } from '@/components/dashboard/event-form';
import { Card, CardContent } from '@/components/ui/card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('newEvent');
  return { title: t('metaTitle') };
}

export default async function NewEventPage() {
  await requireUser();
  const t = await getTranslations('newEvent');

  return (
    <div className="mx-auto max-w-xl px-5 py-8 lg:px-8">
      <PageHeader
        title={t('title')}
        description={t('description')}
      />
      <Card>
        <CardContent className="pt-5">
          <EventForm mode="create" />
        </CardContent>
      </Card>
    </div>
  );
}
