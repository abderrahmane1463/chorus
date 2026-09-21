import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { SignUpForm } from '@/components/auth/auth-form';
import { GoogleSignIn } from '@/components/auth/google-sign-in';
import { isGoogleEnabled } from '@/lib/auth';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('signUpTitle') };
}

export default async function SignUpPage() {
  // Per request, for the same reason as the sign-in page.
  await connection();
  const t = await getTranslations('auth');

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">{t('signUpTitle')}</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">{t('signUpSubtitle')}</p>
      {/* Google creates the account on first sign-in, so the same action serves both pages. */}
      {isGoogleEnabled() && <GoogleSignIn label={t('googleSignUp')} />}
      <SignUpForm />
    </div>
  );
}
