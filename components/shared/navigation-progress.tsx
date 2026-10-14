'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

/** How long a page may take before the bar shows: quicker than this, nothing flickers. */
const SHOW_AFTER_MS = 120;

/**
 * A thin bar along the top of the screen while the next page is on its way.
 *
 * The page being left stays on screen, whole and usable, until the next one
 * is ready, and then the next one appears complete. The bar is the only sign
 * of the wait, and only when there is a wait worth showing: a page that
 * arrives quickly simply replaces the last, with no blank or grey frame.
 */
function Progress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const where = `${pathname}?${searchParams.toString()}`;
  const lastWhere = useRef(where);

  // A click on a link to another page of this site starts the wait.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;

      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
      showTimer.current = setTimeout(() => setState('loading'), SHOW_AFTER_MS);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // The new page is in place: finish the bar and let it fade.
  const shown = useRef(state);
  useEffect(() => {
    shown.current = state;
  }, [state]);
  useEffect(() => {
    if (where === lastWhere.current) return;
    lastWhere.current = where;
    clearTimeout(showTimer.current);
    if (shown.current !== 'loading') return;
    setState('done');
    hideTimer.current = setTimeout(() => setState('idle'), 300);
  }, [where]);

  useEffect(
    () => () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
    },
    [],
  );

  if (state === 'idle') return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden"
    >
      <div
        className={
          state === 'loading'
            ? 'h-full w-full origin-left animate-[navigation-progress_8s_cubic-bezier(0.1,0.7,0.1,1)_forwards] bg-primary rtl:origin-right'
            : 'h-full w-full bg-primary opacity-0 transition-opacity duration-300'
        }
      />
    </div>
  );
}

export function NavigationProgress() {
  // Reading the address needs a boundary of its own, so it never holds up the page.
  return (
    <Suspense fallback={null}>
      <Progress />
    </Suspense>
  );
}
