import { Skeleton } from '@/components/ui/skeleton';

export default function ParticipantLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="mt-6 h-64 w-full" />
    </div>
  );
}
