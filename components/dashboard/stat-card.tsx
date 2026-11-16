import { cn } from '@/lib/utils/cn';

/**
 * A row of headline figures in one ruled strip.
 *
 * One surface with thin dividers rather than a tile per figure: the numbers
 * read as one summary, left to right, and the label sits above each number
 * so the eye lands on the figure, not on a decorative icon.
 */
export function StatStrip({
  items,
  className,
}: {
  items: { label: string; value: number | string }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card',
        items.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-4',
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          // Dividers between cells only: start edges after the first column,
          // top edges on the second row of the two-column phone layout.
          className="border-border px-5 py-4 [&:nth-child(n+2)]:border-s max-sm:[&:nth-child(odd)]:border-s-0 max-sm:[&:nth-child(n+3)]:border-t"
        >
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
