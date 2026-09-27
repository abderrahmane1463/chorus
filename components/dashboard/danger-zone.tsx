'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteEventAction, regenerateEventCodeAction } from '@/lib/actions/event';

/**
 * Destructive event controls. Deleting requires typing the event title, since
 * it cascades to every interaction, response and question underneath it.
 */
export function DangerZone({
  eventId,
  title,
}: {
  eventId: string;
  title: string;
}) {
  const t = useTranslations('danger');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, startDelete] = useTransition();
  const [regenerating, startRegenerate] = useTransition();

  const canDelete = confirmation.trim() === title.trim();

  function remove() {
    if (!canDelete) return;
    startDelete(async () => {
      const result = await deleteEventAction({ eventId });
      // Deleting redirects, so a returned result means it failed.
      if (result && !result.ok) toast.error(result.error);
    });
  }

  function regenerate() {
    startRegenerate(async () => {
      const result = await regenerateEventCodeAction({ eventId });
      if (result.ok) toast.success(t('regenerated'));
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{t('regenTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('regenBody')}</p>
        </div>
        <Button variant="secondary" onClick={regenerate} loading={regenerating}>
          {t('regen')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium">{t('deleteTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('deleteBody')}</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">{t('deleteEvent')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('confirmTitle', { title })}</DialogTitle>
              <DialogDescription>{t('confirmBody')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">{t('eventName')}</Label>
              <Input
                id="confirm"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={title}
                autoComplete="off"
              />
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button
                variant="destructive"
                disabled={!canDelete}
                loading={deleting}
                onClick={remove}
              >
                {t('deletePermanently')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
