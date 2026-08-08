import { useId, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsDailyPoint } from '../domain/analytics';
import { parseRevenue } from '../domain/analytics';
import { EmptyHint } from './EmptyHint';
import { Btn } from './Btn';

const moneyFmt = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type ChartRow = AnalyticsDailyPoint & { revenueNum: number };
type MetricTab = 'revenue' | 'policies';

function formatDayShort(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function formatDayLong(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatAxisCompact(day: string) {
  const [, m, d] = day.split('-').map(Number);
  return `${d}.${m < 10 ? `0${m}` : m}`;
}

function chartLayout(pointCount: number) {
  const dense = pointCount > 14;
  return {
    dense,
    bottom: dense ? 56 : 24,
    chartH: dense ? 300 : 264,
    xTickFormatter: (v: string) => (dense ? formatAxisCompact(v) : formatDayShort(v)),
  };
}

function ChartTooltip({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
  label?: string;
  metric: MetricTab;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="analytics-chart-tooltip">
      <div className="analytics-chart-tooltip-date">{formatDayLong(String(label))}</div>
      <div className="analytics-chart-tooltip-value">
        {metric === 'revenue'
          ? `${moneyFmt.format(row.revenueNum)} ₽`
          : `${row.policiesCount} полис.`}
      </div>
    </div>
  );
}

type AnalyticsDailyChartProps = {
  points: AnalyticsDailyPoint[];
  empty: boolean;
};

export function AnalyticsDailyChart({ points, empty }: AnalyticsDailyChartProps) {
  const [metric, setMetric] = useState<MetricTab>('revenue');
  const gradId = `anGrad-${useId().replace(/:/g, '')}`;

  if (empty) {
    return <EmptyHint variant="chart">Нет оформленных полисов за период.</EmptyHint>;
  }

  if (points.length === 0) {
    return <EmptyHint variant="chart">Нет точек за выбранный период. Измените фильтры или диапазон дат.</EmptyHint>;
  }

  const data: ChartRow[] = points.map((p) => ({ ...p, revenueNum: parseRevenue(p.revenue) }));
  const { dense, bottom, chartH, xTickFormatter } = chartLayout(data.length);

  return (
    <div className="analytics-daily">
      <div className="analytics-daily__tabs" role="tablist" aria-label="Метрика графика">
        <Btn
          role="tab"
          aria-selected={metric === 'revenue'}
          variant="ghost"
          size="sm"
          pill
          softActive={metric === 'revenue'}
          onClick={() => setMetric('revenue')}
        >
          Выручка
        </Btn>
        <Btn
          role="tab"
          aria-selected={metric === 'policies'}
          variant="ghost"
          size="sm"
          pill
          softActive={metric === 'policies'}
          onClick={() => setMetric('policies')}
        >
          Полисы
        </Btn>
      </div>
      <figure className="analytics-chart-figure">
        <div
          className="analytics-recharts"
          role="img"
          aria-label={metric === 'revenue' ? 'Выручка по дням' : 'Полисы по дням'}
        >
          <ResponsiveContainer width="100%" height={chartH} minHeight={240}>
            {metric === 'revenue' ? (
              <AreaChart data={data} margin={{ top: 12, right: 10, left: 6, bottom }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="day"
                  tickFormatter={xTickFormatter}
                  tick={{ fill: 'var(--fg-muted)', fontSize: dense ? 11 : 12 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-strong)' }}
                  interval="preserveStartEnd"
                  angle={dense ? -40 : 0}
                  textAnchor={dense ? 'end' : 'middle'}
                  height={dense ? 40 : 20}
                />
                <YAxis
                  tickFormatter={(v) => moneyFmt.format(Number(v))}
                  tick={{ fill: 'var(--fg-muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                />
                <Tooltip
                  content={<ChartTooltip metric="revenue" />}
                  cursor={{ stroke: 'var(--border-strong)' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenueNum"
                  name="Выручка"
                  stroke="var(--accent)"
                  fill={`url(#${gradId})`}
                  strokeWidth={2}
                />
              </AreaChart>
            ) : (
              <BarChart data={data} margin={{ top: 12, right: 10, left: 6, bottom }} barCategoryGap="12%">
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="day"
                  tickFormatter={xTickFormatter}
                  tick={{ fill: 'var(--fg-muted)', fontSize: dense ? 11 : 12 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-strong)' }}
                  interval="preserveStartEnd"
                  angle={dense ? -40 : 0}
                  textAnchor={dense ? 'end' : 'middle'}
                  height={dense ? 40 : 20}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'var(--fg-muted)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip content={<ChartTooltip metric="policies" />} cursor={{ fill: 'var(--bg-subtle)' }} />
                <Bar dataKey="policiesCount" name="Полисы" fill="var(--success)" radius={[8, 8, 0, 0]} maxBarSize={40} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
        <figcaption className="analytics-chart-caption">
          {metric === 'revenue' ? 'Выручка агента по дням' : 'Число оформленных полисов по дням'}
        </figcaption>
      </figure>
    </div>
  );
}
