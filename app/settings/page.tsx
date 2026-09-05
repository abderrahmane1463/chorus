import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/dashboard/page-header';
import { ProfileForm } from '@/components/dashboard/profile-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 lg:px-8">
      <PageHeader title="Settings" description="Your account details." />
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm defaultName={user.name ?? ''} email={user.email ?? ''} />
        </CardContent>
      </Card>
    </div>
  );
}
