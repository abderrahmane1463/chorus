/**
 * Applies the stored theme before first paint so there is no flash of the
 * wrong palette. Runs inline in <head>, ahead of hydration.
 */
const script = `
try {
  var stored = localStorage.getItem('chorus.theme');
  var dark = stored ? stored === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
