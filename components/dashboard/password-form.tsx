'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePasswordAction } from '@/lib/actions/user';
import { changePasswordSchema, type ChangePasswordInput } from '@/lib/validations/auth';

export function PasswordForm() {
  const t = useTranslations('passwordForm');
  // Unscoped for the schema's keys.
  const tRoot = useTranslations();
  const [pending, startTransition] = useTransition();

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  function onSubmit(values: ChangePasswordInput) {
    startTransition(async () => {
      const result = await changePasswordAction(values);
      if (result.ok) {
        toast.success(t('changed'));
        // Cleared, so the passwords do not sit in the page after use.
        form.reset({ currentPassword: '', newPassword: '' });
      } else {
        toast.error(result.error);
      }
    });
  }

  const errors = form.formState.errors;

  return (
    <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">{t('current')}</Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.currentPassword)}
          {...form.register('currentPassword')}
        />
        {errors.currentPassword && (
          <p className="text-sm text-destructive">
            {tRoot(errors.currentPassword.message ?? 'validation.passwordRequired')}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPassword">{t('new')}</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.newPassword)}
          {...form.register('newPassword')}
        />
        {errors.newPassword ? (
          <p className="text-sm text-destructive">
            {tRoot(errors.newPassword.message ?? 'validation.passwordTooShort')}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{t('hint')}</p>
        )}
      </div>

      <Button type="submit" loading={pending}>
        {t('save')}
      </Button>
    </form>
  );
}
