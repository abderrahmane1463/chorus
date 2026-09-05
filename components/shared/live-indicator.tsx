'use client';

import { useEventSync } from '@/hooks/use-event-sync';
import { channels } from '@/lib/realtime/events';
import { cn } from '@/lib/utils/cn';
import type { ConnectionStatus } from '@/lib/realtime/client';

const PRESENTATION: Record<
  ConnectionStatus,
  { label: string; dot: string; text: string }
> = {
  connecting: {
    label: 'Connecting',
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
  },
  connected: { label: 'Live', dot: 'bg-success', text: 'text-success' },
  reconnecting: {
    label: 'Reconnecting',
    dot: 'bg-accent animate-pulse',
    text: 'text-accent',
  },
  offline: { label: 'Offline', dot: 'bg-destructive', text: 'text-destructive' },
};

/**
 * Subscribes the page to its event's realtime channels and shows the
 * connection state. Mounting this is what makes a server-rendered page live.
 */
export function LiveIndicator({
  eventId,
  withQa = false,
  className,
}: {
  eventId: string;
  /** Also listen on the Q&A channel. */
  withQa?: boolean;
  className?: string;
}) {
  const names = withQa
    ? [channels.event(eventId), channels.qa(eventId)]
    : [channels.event(eventId)];

  const status = useEventSync(eventId, { channels: names });
  const view = PRESENTATION[status];

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs font-medium', view.text, className)}
      role="status"
      aria-live="polite"
    >
      <span className={cn('size-1.5 rounded-full', view.dot)} aria-hidden />
      {view.label}
    </span>
  );
}

/** Subscribes without rendering anything, for screens with their own chrome. */
export function EventSync({
  eventId,
  withQa = false,
}: {
  eventId: string;
  withQa?: boolean;
}) {
  const names = withQa
    ? [channels.event(eventId), channels.qa(eventId)]
    : [channels.event(eventId)];

  useEventSync(eventId, { channels: names });
  return null;
}
