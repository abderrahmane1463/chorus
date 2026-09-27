'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { updateEventStatusAction } from '@/lib/actions/event';
import type { eventStatuses } from '@/lib/validations/event';

type Status = (typeof eventStatuses)[number];

const nextLabel: Record<
  Status,
  { key: 'open' | 'end' | 'reopen' | 'restore'; next: Status } | null
> = {
  draft: { key: 'open', next: 'live' },
  live: { key: 'end', next: 'ended' },
  ended: { key: 'reopen', next: 'live' },
  archived: { key: 'restore', next: 'draft' },
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
  const t = useTranslations('eventStatus');
  const [pending, startTransition] = useTransition();
  const action = nextLabel[status];

  if (!action) return null;

  function apply() {
    if (!action) return;
    startTransition(async () => {
      const result = await updateEventStatusAction({ eventId, status: action.next });
      if (result.ok) {
        toast.success(
          action.next === 'live'
            ? t('nowLive')
            : action.next === 'ended'
              ? t('nowEnded')
              : t('nowDraft'),
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
      {t(action.key)}
    </Button>
  );
}
