'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { INTERACTION_TYPES } from '@/lib/interactions/registry';
import { createInteractionAction } from '@/lib/actions/interaction';

export function InteractionTypePicker({
  eventId,
  variant = 'primary',
  label,
  className,
}: {
  eventId: string;
  variant?: 'primary' | 'secondary';
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const t = useTranslations('picker');
  const tTypes = useTranslations('types');
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function create(type: string) {
    startTransition(async () => {
      const result = await createInteractionAction({ eventId, type });
      if (result.ok && result.interactionId) {
        setOpen(false);
        // Open the new interaction straight into its editor.
        router.push(`/dashboard/events/${eventId}?i=${result.interactionId}`);
        router.refresh();
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className={className}>
          <Plus />
          {label ?? t('add')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('body')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {INTERACTION_TYPES.map((meta) => (
            <button
              key={meta.type}
              type="button"
              disabled={pending}
              onClick={() => create(meta.type)}
              className="rounded-lg border border-border p-4 text-start transition-colors hover:border-primary hover:bg-muted disabled:opacity-50"
            >
              <meta.icon className="size-5 text-primary" aria-hidden />
              <p className="mt-2 font-medium">{tTypes(`${meta.type}.name`)}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {tTypes(`${meta.type}.description`)}
              </p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
