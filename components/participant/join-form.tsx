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

export function JoinForm({ defaultCode = '' }: { defaultCode?: string }) {
  // Unscoped: validation messages arrive as full keys from the schema.
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<JoinEventInput>({
    resolver: zodResolver(joinEventSchema),
    defaultValues: { code: defaultCode, displayName: '' },
  });

  function onSubmit(values: JoinEventInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await joinEventAction(values);
      // Joining redirects, so anything returned here is a failure.
      if (result && !result.ok) {
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
          {...form.register('code')}
        />
        {form.formState.errors.code && (
          <p className="text-sm text-destructive">
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

      {formError && (
        <p className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t('join.submit')}
      </Button>
    </form>
  );
}
