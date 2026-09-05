'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInAction, signUpAction } from '@/lib/actions/auth';
import {
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from '@/lib/validations/auth';

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '';
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  function onSubmit(values: SignInInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await signInAction(values, callbackUrl);
      if (result.ok) {
        // Auth.js redirects by throwing, but it does not always do so.
        // Navigating here means success never silently does nothing.
        router.push(callbackUrl || '/dashboard');
        router.refresh();
        return;
      }
      setFormError(result.error);
      toast.error(result.error);
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
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          aria-invalid={Boolean(form.formState.errors.email)}
          {...form.register('email')}
        />
        <FieldError message={form.formState.errors.email?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(form.formState.errors.password)}
          {...form.register('password')}
        />
        <FieldError message={form.formState.errors.password?.message} />
      </div>

      {formError && (
        <p className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" className="w-full" loading={pending}>
        Sign in
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New to Chorus?{' '}
        <Link href="/sign-up" className="text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  function onSubmit(values: SignUpInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await signUpAction(values);
      if (result.ok) {
        router.push('/dashboard');
        router.refresh();
        return;
      }
      setFormError(result.error);
      toast.error(result.error);
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
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          autoComplete="name"
          placeholder="Amine Cherfaoui"
          aria-invalid={Boolean(form.formState.errors.name)}
          {...form.register('name')}
        />
        <FieldError message={form.formState.errors.name?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          aria-invalid={Boolean(form.formState.errors.email)}
          {...form.register('email')}
        />
        <FieldError message={form.formState.errors.email?.message} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          aria-invalid={Boolean(form.formState.errors.password)}
          {...form.register('password')}
        />
        <FieldError message={form.formState.errors.password?.message} />
      </div>

      {formError && (
        <p className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" className="w-full" loading={pending}>
        Create account
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
