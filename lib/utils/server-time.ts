import 'server-only';

/**
 * The server's clock, in milliseconds, for handing to the browser.
 *
 * Quiz questions are stamped and scored on this clock. A page that sends it
 * along lets the countdown correct for a device whose own clock is wrong.
 */
export function serverNow(): number {
  return Date.now();
}
