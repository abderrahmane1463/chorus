'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Re-reads the theme whenever the root element's class list changes. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

/**
 * Flips the `dark` class and remembers the choice for the next visit.
 * The DOM is the source of truth here — the inline theme script sets the class
 * before React hydrates, so reading it avoids a mismatched first render.
 */
export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains('dark'),
    () => false,
  );

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('chorus.theme', next ? 'dark' : 'light');
    } catch {
      // Storage can be unavailable in private windows; the toggle still works.
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Moon /> : <Sun />}
    </Button>
  );
}
