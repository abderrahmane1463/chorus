import { Button } from '@/components/ui/button';
import { signInWithGoogleAction } from '@/lib/actions/auth';

/** Google's own mark, which its sign-in branding guidelines ask buttons to use. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3A7.2 7.2 0 0 1 12 19.2a7.18 7.18 0 0 1-6.73-4.96H1.26v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.24a7.2 7.2 0 0 1 0-4.48v-3.1H1.26a12 12 0 0 0 0 10.68l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.26 6.66l4.01 3.1A7.18 7.18 0 0 1 12 4.77Z"
      />
    </svg>
  );
}

/**
 * Its own form, rendered beside the email form rather than inside it: forms
 * cannot nest, and this one posts to a Server Action, not the credentials flow.
 */
export function GoogleSignIn({
  label,
  callbackUrl,
}: {
  label: string;
  callbackUrl?: string;
}) {
  return (
    <>
      <form action={signInWithGoogleAction}>
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? ''} />
        <Button type="submit" variant="secondary" className="w-full">
          <GoogleMark />
          {label}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}
