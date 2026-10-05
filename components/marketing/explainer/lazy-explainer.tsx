'use client';

import dynamic from 'next/dynamic';

/**
 * The film is a page of its own weight: it loads after the page around it,
 * with a frame of the same shape standing in, so nothing moves when it lands.
 */
const Explainer = dynamic(() => import('./explainer').then((module) => module.Explainer), {
  ssr: false,
  loading: () => (
    <div>
      <div className="aspect-[3/4] rounded-2xl border border-border bg-[#0a1215] sm:aspect-video" />
      <div className="mt-4 h-10" />
    </div>
  ),
});

export function LazyExplainer() {
  return <Explainer />;
}
