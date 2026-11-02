'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { joinEventAction } from '@/lib/actions/join';
import { joinEventSchema, type JoinEventInput } from '@/lib/validations/user';

/**
 * Joins an event by its code. When the event asks for consent, the visitor
 * ticks its statement first: known up front when they arrive by the QR code,
 * learned from the server when they typed the code by hand.
 */
export function JoinForm({
  defaultCode = '',
  consent = null,
}: {
  defaultCode?: string;
  /** The statement to accept, or null when the event asks for none. */
  consent?: { text: string | null } | null;
}) {
  // Unscoped: validation messages arrive as full keys from the schema.
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [asked, setAsked] = useState(consent);
  const [consentMissing, setConsentMissing] = useState(false);

  const form = useForm<JoinEventInput>({
    resolver: zodResolver(joinEventSchema),
    defaultValues: { code: defaultCode, displayName: '', consent: false },
  });

  function onSubmit(values: JoinEventInput) {
    setFormError(null);
    if (asked && !values.consent) {
      setConsentMissing(true);
      return;
    }
    setConsentMissing(false);
    startTransition(async () => {
      const result = await joinEventAction(values);
      // Joining redirects, so anything returned here is a failure.
      if (result && !result.ok) {
        if ('consent' in result) {
          setAsked({ text: result.consent });
          setConsentMissing(true);
          return;
        }
        setFormError(result.error);
        toast.error(result.error);
      }
    });
  }

  return (
    <form
      method="post"
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
    >
      <div className="space-y-1.5">
        <Label htmlFor="code">{t('join.code')}</Label>
        <Input
          id="code"
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="BRAVO-42"
          className="h-12 text-center text-lg font-medium uppercase tracking-[0.15em]"
          aria-invalid={Boolean(form.formState.errors.code)}
          aria-describedby={form.formState.errors.code ? 'code-error' : undefined}
          {...form.register('code')}
        />
        {form.formState.errors.code && (
          <p id="code-error" role="alert" className="text-sm text-destructive">
            {t(form.formState.errors.code.message ?? 'validation.codeRequired')}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="displayName">{t('join.name')}</Label>
        <Input
          id="displayName"
          autoComplete="name"
          placeholder={t('join.namePlaceholder')}
          {...form.register('displayName')}
        />
      </div>

      {asked && (
        <div className="space-y-1.5">
          <label
            htmlFor="consent"
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm leading-relaxed"
          >
            <input
              id="consent"
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 accent-primary"
              aria-invalid={consentMissing}
              aria-describedby={consentMissing ? 'consent-error' : undefined}
              {...form.register('consent', {
                onChange: (event) => event.target.checked && setConsentMissing(false),
              })}
            />
            <span dir="auto" className="whitespace-pre-line">
              {asked.text ?? t('join.consentDefault')}
            </span>
          </label>
          {consentMissing && (
            <p id="consent-error" role="alert" className="text-sm text-destructive">
              {t('join.consentRequired')}
            </p>
          )}
        </div>
      )}

      {formError && (
        <p role="alert" className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t('join.submit')}
      </Button>
    </form>
  );
}
