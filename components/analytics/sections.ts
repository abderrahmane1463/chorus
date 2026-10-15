/** The parts of an event's report, which a shared link may show some of. */
export const REPORT_SECTIONS = ['engagement', 'qa', 'polls', 'quizzes'] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

/** How long a shared link may last, in days. */
export const SHARE_DAYS = [1, 7, 30] as const;
