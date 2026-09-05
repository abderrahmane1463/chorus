'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { updateEventStatusAction } from '@/lib/actions/event';
import type { eventStatuses } from '@/lib/validations/event';

type Status = (typeof eventStatuses)[number];

const nextLabel: Record<Status, { label: string; next: Status } | null> = {
  draft: { label: 'Open event', next: 'live' },
  live: { label: 'End event', next: 'ended' },
  ended: { label: 'Reopen event', next: 'live' },
  archived: { label: 'Restore event', next: 'draft' },
};

/**
 * Moves an event between draft, live and ended.
 * Participants can only join events that are not archived.
 */
export function EventStatusControl({
  eventId,
  status,
}: {
  eventId: string;
  status: Status;
}) {
  const [pending, startTransition] = useTransition();
  const action = nextLabel[status];

  if (!action) return null;

  function apply() {
    if (!action) return;
    startTransition(async () => {
      const result = await updateEventStatusAction({ eventId, status: action.next });
      if (result.ok) {
        toast.success(
          action.next === 'live' ? 'Event is live' : `Event ${action.next}`,
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      variant={status === 'live' ? 'secondary' : 'primary'}
      onClick={apply}
      loading={pending}
    >
      {action.label}
    </Button>
  );
}
