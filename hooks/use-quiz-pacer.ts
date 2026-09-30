'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { syncQuizAction } from '@/lib/actions/quiz';
import { PROMPT_LEAD_MS } from '@/lib/quiz/pacing';

const RETRY_MS = 2000;
const MAX_ATTEMPTS = 8;

/** How long to give realtime to deliver the new state before fetching it directly. */
const REFRESH_FALLBACK_MS = 900;

/**
 * Which screen this is, which decides when it asks the quiz to move on.
 *
 * - `stage`: the projector. Asks just ahead of the deadline; the server holds
 *   the request until the moment itself, so the round trip is spent while the
 *   timer is still running instead of after it has reached zero.
 * - `backup`: the host's dashboard. Asks just after the deadline, in case the
 *   projector is not open.
 * - `participant`: a phone. Asks later still, spread out, and only matters if
 *   no host screen got there first.
 *
 * Only the stage holds a request open. Every held request occupies one of the
 * few connections a browser allows to a site over HTTP/1.1, and a host
 * usually has the projector and the dashboard open in the same browser: with
 * both holding, ordinary page refreshes were left queueing for a free one.
 */
export type PacerRole = 'stage' | 'backup' | 'participant';

function promptOffset(role: PacerRole): number {
  if (role === 'stage') return -PROMPT_LEAD_MS;
  if (role === 'backup') return 400;
  return 1500 + Math.random() * 2500;
}

/**
 * Keeps an automatically paced quiz moving.
 *
 * When the step the quiz is waiting on comes due, this asks the server to
 * take it. The server decides whether it really is due, so this is only a
 * prompt, and the quiz does not depend on any one screen staying open.
 *
 * `dueAt` and `serverNow` are both on the server's clock, so the wait is
 * their difference and the device's own clock never enters into it.
 */
export function useQuizPacer({
  quizId,
  dueAt,
  serverNow,
  role,
}: {
  quizId: string;
  /** When the quiz next moves on by itself (epoch ms), or null if it waits for the host. */
  dueAt: number | null;
  serverNow: number;
  role: PacerRole;
}) {
  const router = useRouter();

  useEffect(() => {
    if (dueAt === null) return;

    let cancelled = false;
    let promptTimer: ReturnType<typeof setTimeout>;
    let refreshTimer: ReturnType<typeof setTimeout>;
    let attempts = 0;

    const prompt = async () => {
      if (cancelled) return;
      attempts += 1;

      const result = await syncQuizAction({ quizId }).catch(() => null);
      if (cancelled) return;

      // When the quiz moves, every screen is told over realtime and refetches,
      // this one included; that changes `dueAt` and ends this effect. So this
      // fetch normally never runs. It is here for the case where that message
      // does not arrive, which would otherwise leave this screen on the old
      // step with nothing left to move it.
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (!cancelled) router.refresh();
      }, REFRESH_FALLBACK_MS);

      // Still waiting on the same step: the server's clock had not reached
      // it, or the request failed.
      if (!result?.ok || !result.advanced) {
        if (attempts < MAX_ATTEMPTS) promptTimer = setTimeout(prompt, RETRY_MS);
      }
    };

    // Measured once, when this step's deadline first arrives from the server.
    promptTimer = setTimeout(prompt, Math.max(0, dueAt - serverNow + promptOffset(role)));

    return () => {
      cancelled = true;
      clearTimeout(promptTimer);
      clearTimeout(refreshTimer);
    };
    // `serverNow` is deliberately left out: it changes on every refresh, and
    // restarting the wait from a fresh sample would add nothing but drift.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId, dueAt, role, router]);
}
