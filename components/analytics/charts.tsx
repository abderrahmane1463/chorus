'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/** Chart colours come from the theme tokens so both themes stay legible. */
const AXIS = 'var(--muted-foreground)';
const GRID = 'var(--border)';
const PRIMARY = 'var(--primary)';

const tooltipStyle = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--foreground)',
  fontSize: 13,
};

/** Values arrive as "YYYY-MM-DDTHH:MM"; the clock time is the useful part. */
function shortTime(value: unknown): string {
  return typeof value === 'string' ? value.slice(11) : '';
}

export function ResponsesOverTime({
  data,
}: {
  data: { minute: string; responses: number }[];
}) {
  if (data.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Not enough activity yet to draw a trend.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="minute"
          tickFormatter={shortTime}
          stroke={AXIS}
          fontSize={12}
          tickLine={false}
        />
        <YAxis stroke={AXIS} fontSize={12} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={shortTime}
        />
        <Line
          type="monotone"
          dataKey="responses"
          stroke={PRIMARY}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ResponsesByInteraction({
  data,
}: {
  data: { title: string; responses: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No interactions to compare yet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 46, 140)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
      >
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" stroke={AXIS} fontSize={12} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="title"
          stroke={AXIS}
          fontSize={12}
          width={150}
          tickLine={false}
          tickFormatter={(value: string) =>
            value.length > 22 ? `${value.slice(0, 21)}…` : value
          }
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--muted)' }} />
        <Bar dataKey="responses" fill={PRIMARY} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
