import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { PageHeader } from '@/components/dashboard/page-header';
import { ProfileForm } from '@/components/dashboard/profile-form';
import { PasswordForm } from '@/components/dashboard/password-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settingsPage');
  return { title: t('title') };
}

export default async function SettingsPage() {
  const user = await requireUser();
  const t = await getTranslations('settingsPage');

  // Accounts made with Google have no password here to change.
  const [account] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const hasPassword = Boolean(account?.passwordHash);

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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t('password')}</CardTitle>
        </CardHeader>
        <CardContent>
          {hasPassword ? (
            <PasswordForm />
          ) : (
            <p className="text-sm text-muted-foreground">{t('googleOnly')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
