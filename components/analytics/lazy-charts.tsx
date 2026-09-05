'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Recharts is heavy and only the analytics page needs it, so both charts load
 * on demand rather than shipping with every dashboard route.
 */
const fallback = <Skeleton className="h-60 w-full" />;

export const ResponsesOverTime = dynamic(
  () => import('./charts').then((mod) => mod.ResponsesOverTime),
  { ssr: false, loading: () => fallback },
);

export const ResponsesByInteraction = dynamic(
  () => import('./charts').then((mod) => mod.ResponsesByInteraction),
  { ssr: false, loading: () => fallback },
);
