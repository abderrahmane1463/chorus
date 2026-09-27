import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { ProfileForm } from '@/components/dashboard/profile-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settingsPage');
  return { title: t('title') };
}

export default async function SettingsPage() {
  const user = await requireUser();
  const t = await getTranslations('settingsPage');

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 lg:px-8">
      <PageHeader title={t('title')} description={t('description')} />
      <Card>
        <CardHeader>
          <CardTitle>{t('profile')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm defaultName={user.name ?? ''} email={user.email ?? ''} />
        </CardContent>
      </Card>
    </div>
  );
}
