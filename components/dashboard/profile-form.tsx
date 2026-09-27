'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateProfileAction } from '@/lib/actions/user';
import {
  updateProfileSchema,
  type UpdateProfileInput,
} from '@/lib/validations/user';

export function ProfileForm({
  defaultName,
  email,
}: {
  defaultName: string;
  email: string;
}) {
  const t = useTranslations('profile');
  // Unscoped for schema keys.
  const tRoot = useTranslations();
  const [pending, startTransition] = useTransition();

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: defaultName },
  });

  function onSubmit(values: UpdateProfileInput) {
    startTransition(async () => {
      const result = await updateProfileAction(values);
      if (result.ok) {
        toast.success(t('updated'));
        form.reset(values);
      } else {
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
        <Label htmlFor="name">{t('displayName')}</Label>
        <Input
          id="name"
          aria-invalid={Boolean(form.formState.errors.name)}
          {...form.register('name')}
        />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">
            {tRoot(form.formState.errors.name.message ?? 'validation.nameTooShort')}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">{t('email')}</Label>
        <Input id="email" value={email} readOnly disabled dir="ltr" />
        <p className="text-xs text-muted-foreground">
          {t('emailLocked')}
        </p>
      </div>

      <Button type="submit" loading={pending} disabled={!form.formState.isDirty}>
        {t('save')}
      </Button>
    </form>
  );
}
