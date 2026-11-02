'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { updateEventConsentAction } from '@/lib/actions/event';
import type { EventSettings } from '@/types/event-settings';

/**
 * Whether visitors accept a statement before joining, and its wording.
 * Left empty, the wording is Chorus's own, shown in the field as a hint.
 */
export function ConsentSettings({
  eventId,
  consent,
}: {
  eventId: string;
  consent: EventSettings['consent'];
}) {
  const t = useTranslations('eventSettings');
  const tJoin = useTranslations('join');
  const [enabled, setEnabled] = useState(consent?.enabled ?? false);
  const [text, setText] = useState(consent?.text ?? '');
  const [saving, startSave] = useTransition();

  function save() {
    startSave(async () => {
      const result = await updateEventConsentAction({ eventId, enabled, text });
      if (result.ok) toast.success(t('consentSaved'));
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6">
        <div>
          <Label htmlFor="consent-enabled">{t('consentEnable')}</Label>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('consentEnableHint')}</p>
        </div>
        <Switch id="consent-enabled" checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {enabled && (
        <div className="space-y-1.5">
          <Label htmlFor="consent-text">{t('consentText')}</Label>
          <Textarea
            id="consent-text"
            rows={4}
            maxLength={600}
            value={text}
            placeholder={tJoin('consentDefault')}
            onChange={(event) => setText(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">{t('consentTextHint')}</p>
        </div>
      )}

      <Button onClick={save} loading={saving}>
        {t('consentSave')}
      </Button>
    </div>
  );
}
