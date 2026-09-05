import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth';
import { DashboardSidebar } from '@/components/dashboard/sidebar';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // requireUser re-reads the account, so a deleted host loses access here.
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <DashboardSidebar user={user} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
