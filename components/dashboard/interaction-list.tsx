'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Radio } from 'lucide-react';
import { getInteractionMeta } from '@/lib/interactions/registry';
import type { InteractionListItem } from '@/lib/queries/interactions';
import { cn } from '@/lib/utils/cn';

export function InteractionList({
  eventId,
  interactions,
  selectedId,
}: {
  eventId: string;
  interactions: InteractionListItem[];
  selectedId?: string;
}) {
  const t = useTranslations('interactionList');
  const tTypes = useTranslations('types');
  const tDash = useTranslations('dash');

  return (
    <ul className="space-y-1">
      {interactions.map((interaction, index) => {
        const meta = getInteractionMeta(interaction.type);
        const Icon = meta?.icon;
        const active = interaction.id === selectedId;
        const typeName = meta
          ? tTypes(`${meta.type}.name`)
          : (interaction.type as string);

        return (
          <li key={interaction.id}>
            <Link
              href={`/dashboard/events/${eventId}?i=${interaction.id}`}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors',
                active
                  ? 'border-primary bg-primary-subtle'
                  : 'border-transparent hover:bg-muted',
              )}
            >
              {Icon && (
                <Icon
                  className={cn(
                    'mt-0.5 size-4 shrink-0',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                  aria-hidden
                />
              )}
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block truncate text-sm',
                    active ? 'font-medium text-primary' : 'font-medium',
                    !interaction.title && 'italic text-muted-foreground',
                  )}
                >
                  {interaction.title ||
                    t('untitled', {
                      type: meta ? typeName : t('untitledFallback'),
                    })}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {interaction.status === 'active' && (
                    <Radio className="size-3 text-success" aria-hidden />
                  )}
                  {interaction.status === 'active'
                    ? t('live')
                    : t('numbered', { index: index + 1, type: typeName })}
                  {interaction.responseCount > 0 &&
                    ` · ${tDash('responseCount', { count: interaction.responseCount })}`}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
