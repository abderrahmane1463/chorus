import 'server-only';
import { and, count, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { analyticsShares, events } from '@/db/schema';
import { REPORT_SECTIONS, type ReportSection } from '@/components/analytics/sections';

/** A link still usable: not switched off, not expired. */
const usable = () => and(isNull(analyticsShares.revokedAt), gt(analyticsShares.expiresAt, new Date()));

/** The event and sections a link opens, or null if it is unknown, expired or switched off. */
export async function findReportShare(token: string) {
  // Tokens are 32 characters of base64url; anything else is not one.
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;

  const [share] = await db
    .select({
      eventId: analyticsShares.eventId,
      sections: analyticsShares.sections,
      expiresAt: analyticsShares.expiresAt,
      title: events.title,
    })
    .from(analyticsShares)
    .innerJoin(events, eq(events.id, analyticsShares.eventId))
    .where(and(eq(analyticsShares.token, token), usable()))
    .limit(1);

  if (!share) return null;
  const sections = share.sections.filter((section): section is ReportSection =>
    (REPORT_SECTIONS as readonly string[]).includes(section),
  );
  return { ...share, sections };
}

/** How many links to an event's report are live right now. */
export async function countActiveShares(eventId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(analyticsShares)
    .where(and(eq(analyticsShares.eventId, eventId), usable()));
  return row?.total ?? 0;
}
