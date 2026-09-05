'use client';

import { useState, useTransition } from 'react';
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
      if (result.ok) toast.success('New event code generated');
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Regenerate join code</p>
          <p className="text-sm text-muted-foreground">
            The old code stops working immediately.
          </p>
        </div>
        <Button variant="secondary" onClick={regenerate} loading={regenerating}>
          Regenerate
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium">Delete this event</p>
          <p className="text-sm text-muted-foreground">
            Removes every interaction, response and question. Cannot be undone.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">Delete event</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete “{title}”?</DialogTitle>
              <DialogDescription>
                This permanently removes the event and everything in it. To
                confirm, type the event name below.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Event name</Label>
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
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!canDelete}
                loading={deleting}
                onClick={remove}
              >
                Delete permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
