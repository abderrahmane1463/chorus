'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateEventKioskAction } from '@/lib/actions/event';
import type { EventSettings } from '@/types/event-settings';

/**
 * The thanks the kiosk tablet shows a visitor once they have taken part.
 * Left empty, each line keeps Chorus's own words, shown in the field.
 */
export function KioskSettings({
  eventId,
  kiosk,
}: {
  eventId: string;
  kiosk: EventSettings['kiosk'];
}) {
  const t = useTranslations('eventSettings');
  const tKiosk = useTranslations('kiosk');
  const [thanks, setThanks] = useState(kiosk?.thanks ?? '');
  const [thanksBody, setThanksBody] = useState(kiosk?.thanksBody ?? '');
  const [saving, startSave] = useTransition();

  function save() {
    startSave(async () => {
      const result = await updateEventKioskAction({ eventId, thanks, thanksBody });
      if (result.ok) toast.success(t('kioskSaved'));
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="kiosk-thanks">{t('kioskThanks')}</Label>
        <Input
          id="kiosk-thanks"
          maxLength={120}
          value={thanks}
          placeholder={tKiosk('thanks')}
          onChange={(event) => setThanks(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="kiosk-thanks-body">{t('kioskThanksBody')}</Label>
        <Input
          id="kiosk-thanks-body"
          maxLength={200}
          value={thanksBody}
          placeholder={tKiosk('thanksBody')}
          onChange={(event) => setThanksBody(event.target.value)}
        />
      </div>
      <Button variant="secondary" onClick={save} loading={saving}>
        {t('kioskSave')}
      </Button>
    </div>
  );
}
