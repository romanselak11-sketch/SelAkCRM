import { useCallback, useEffect, useId, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, ApiError } from '../api';
import { AnalyticsPeriodPicker, type AnalyticsPreset } from '../components/AnalyticsPeriodPicker';
import { PageHeading } from '../components/PageHeading';
import { setDocumentTitle } from '../utils/documentTitle';

type DailyPoint = { day: string; revenue: string; policiesCount: number };

type Summary = {
  revenue: string;
  policiesCount: number;
  prevRevenue: string;
  prevPoliciesCount: number;
  periodDays: number;
  prevFrom: string;
  prevTo: string;
  revenueDeltaPct: number | null;
  policiesDeltaPct: number | null;
};

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function localYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function presetToday() {
  const t = new Date();
  return { from: localYMD(t), to: localYMD(t) };
}

function presetYesterday() {
  const t = new Date();
  t.setDate(t.getDate() - 1);
  const y = localYMD(t);
  return { from: y, to: y };
}

/** Последние 7 дней, включая сегодня */
function presetWeek() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 6);
  return { from: localYMD(from), to: localYMD(to) };
}

/** С 1-го числа текущего месяца по сегодня */
function presetMonthCalendar() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from: localYMD(from), to: localYMD(to) };
}

function parseRev(s: string) {
  return Number(s) || 0;
}

const pctFmt = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

const moneyFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

const revAxisFmt = new Intl.NumberFormat('ru-RU', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function ymdToDdMmYyyy(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${pad2(d)}-${pad2(m)}-${y}`;
}

function formatPeriodButtonLabel(fromYmd: string, toYmd: string) {
  return `${ymdToDdMmYyyy(fromYmd)} — ${ymdToDdMmYyyy(toYmd)}`;
}

function formatPrevPeriodRange(prevFrom: string, prevTo: string) {
  return `${ymdToDdMmYyyy(prevFrom)} - ${ymdToDdMmYyyy(prevTo)}`;
}

function policiesWord(n: number): string {
  const m = Math.abs(n) % 100;
  const e = m % 10;
  if (m > 10 && m < 20) return 'полисов';
  if (e === 1) return 'полис';
  if (e >= 2 && e <= 4) return 'полиса';
  return 'полисов';
}

function policiesLabel(n: number): string {
  return `${n} ${policiesWord(n)}`;
}

function formatDayShort(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function formatDayLong(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Короткая подпись для плотной оси: 12.04 */
function formatAxisCompact(day: string) {
  const [, m, d] = day.split('-').map(Number);
  return `${d}.${pad2(m)}`;
}

function IconWallet(props: { className?: string }) {
  return (
    <svg className={props.className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 10h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M3 10V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2M16 14h2.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconDocument(props: { className?: string }) {
  return (
    <svg className={props.className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function PreviousPeriodPanel({
  days,
  revenue,
  policiesCount,
  prevFrom,
  prevTo,
}: {
  days: number;
  revenue: string;
  policiesCount: number;
  prevFrom: string;
  prevTo: string;
}) {
  const rev = parseRev(revenue);
  const rangeLabel = formatPrevPeriodRange(prevFrom, prevTo);
  return (
    <div
      className="metric metric--previous-period"
      role="region"
      aria-label={`Предыдущий период ${rangeLabel}: ${days} дней, выручка ${moneyFmt.format(rev)} рублей, ${policiesLabel(policiesCount)}`}
    >
      <div className="analytics-prev-period__head">
        <div className="analytics-prev-period__head-text">
          <h2 className="analytics-prev-period__title">Предыдущий период</h2>
          <p className="analytics-prev-period__range">{rangeLabel}</p>
        </div>
        <span className="analytics-prev-period__badge">{days} дн.</span>
      </div>
      <div className="analytics-prev-period__stats">
        <div className="analytics-prev-period__stat">
          <div className="analytics-prev-period__stat-icon" aria-hidden>
            <IconWallet />
          </div>
          <div className="analytics-prev-period__stat-body">
            <p className="analytics-prev-period__stat-label">Выручка агента</p>
            <p className="analytics-prev-period__stat-value">
              {moneyFmt.format(rev)}&nbsp;<span className="analytics-prev-period__stat-currency">₽</span>
            </p>
          </div>
        </div>
        <div className="analytics-prev-period__stat">
          <div className="analytics-prev-period__stat-icon" aria-hidden>
            <IconDocument />
          </div>
          <div className="analytics-prev-period__stat-body">
            <p className="analytics-prev-period__stat-label">Оформлено полисов</p>
            <p className="analytics-prev-period__stat-value analytics-prev-period__stat-value--policies">
              <span className="analytics-prev-period__stat-num">{policiesCount}</span>
              <span className="analytics-prev-period__stat-unit">{policiesWord(policiesCount)}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueDelta({ pct, currentRevenue }: { pct: number | null; currentRevenue: string }) {
  const cur = parseRev(currentRevenue);
  if (pct === null) {
    if (cur > 0) {
      return (
        <p className="metric-delta metric-delta--up">
          К прошлому периоду: в сравниваемом интервале не было выручки — рост от нуля
        </p>
      );
    }
    return (
      <p className="metric-delta metric-delta--flat">
        К прошлому периоду: оба периода без выручки
      </p>
    );
  }
  if (pct > 0) {
    return (
      <p className="metric-delta metric-delta--up">
        К прошлому периоду по выручке: {pctFmt.format(pct)}%
      </p>
    );
  }
  if (pct < 0) {
    return (
      <p className="metric-delta metric-delta--down">
        К прошлому периоду по выручке: {pctFmt.format(pct)}%
      </p>
    );
  }
  return <p className="metric-delta metric-delta--flat">К прошлому периоду по выручке: без изменений (0%)</p>;
}

function PoliciesDelta({ pct, currentCount }: { pct: number | null; currentCount: number }) {
  if (pct === null) {
    if (currentCount > 0) {
      return (
        <p className="metric-delta metric-delta--up">
          К прошлому периоду: в сравниваемом интервале не было полисов — рост от нуля
        </p>
      );
    }
    return (
      <p className="metric-delta metric-delta--flat">
        К прошлому периоду: оба периода без полисов
      </p>
    );
  }
  if (pct > 0) {
    return (
      <p className="metric-delta metric-delta--up">
        К прошлому периоду по полисам: {pctFmt.format(pct)}%
      </p>
    );
  }
  if (pct < 0) {
    return (
      <p className="metric-delta metric-delta--down">
        К прошлому периоду по полисам: {pctFmt.format(pct)}%
      </p>
    );
  }
  return <p className="metric-delta metric-delta--flat">К прошлому периоду по полисам: без изменений (0%)</p>;
}

type ChartRow = DailyPoint & { revenueNum: number };

function chartLayout(pointCount: number) {
  const dense = pointCount > 14;
  const bottom = dense ? 56 : 24;
  const chartH = dense ? 300 : 264;
  const xTickFormatter = (v: string) => (dense ? formatAxisCompact(v) : formatDayShort(v));
  return { dense, bottom, chartH, xTickFormatter };
}

function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="analytics-chart-tooltip">
      <div className="analytics-chart-tooltip-date">{formatDayLong(String(label))}</div>
      <div className="analytics-chart-tooltip-value">{moneyFmt.format(row.revenueNum)} ₽</div>
    </div>
  );
}

function PoliciesTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="analytics-chart-tooltip analytics-chart-tooltip--policies">
      <div className="analytics-chart-tooltip-date">{formatDayLong(String(label))}</div>
      <div className="analytics-chart-tooltip-value analytics-chart-tooltip-value--policies">
        {policiesLabel(row.policiesCount)}
      </div>
      <div className="analytics-chart-tooltip-meta">Выручка за день: {moneyFmt.format(row.revenueNum)} ₽</div>
    </div>
  );
}

function RevenueChart({ points }: { points: DailyPoint[] }) {
  const gradId = `revGrad-${useId().replace(/:/g, '')}`;

  if (points.length === 0) {
    return (
      <p className="empty-hint empty-hint--chart">Нет данных за выбранный период.</p>
    );
  }

  const data: ChartRow[] = points.map((p) => ({
    ...p,
    revenueNum: parseRev(p.revenue),
  }));

  const { dense, bottom, chartH, xTickFormatter } = chartLayout(data.length);

  return (
    <figure className="analytics-chart-figure">
      <div className="analytics-recharts" role="img" aria-label="Диаграмма выручки по дням">
        <ResponsiveContainer width="100%" height={chartH} minHeight={240}>
          <BarChart
            data={data}
            margin={{ top: 12, right: 10, left: 6, bottom }}
            barCategoryGap={dense ? '8%' : '14%'}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
                <stop offset="40%" stopColor="var(--accent)" stopOpacity={0.85} />
                <stop offset="100%" stopColor="var(--accent-hover)" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--border)" strokeOpacity={0.85} />
            <XAxis
              dataKey="day"
              tickFormatter={xTickFormatter}
              tick={{ fill: 'var(--fg-muted)', fontSize: dense ? 11 : 12, fontWeight: 600 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-strong)' }}
              interval="preserveStartEnd"
              minTickGap={dense ? 20 : 36}
              angle={dense ? -40 : 0}
              dy={dense ? 8 : 0}
              textAnchor={dense ? 'end' : 'middle'}
              height={dense ? 40 : 20}
            />
            <YAxis
              tickFormatter={(v) => revAxisFmt.format(Number(v))}
              tick={{ fill: 'var(--fg-muted)', fontSize: 11, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              cursor={{ fill: 'var(--accent-soft)', opacity: 0.4 }}
              content={<RevenueTooltip />}
              wrapperStyle={{ outline: 'none' }}
            />
            <Bar
              dataKey="revenueNum"
              name="Выручка"
              fill={`url(#${gradId})`}
              radius={[8, 8, 0, 0]}
              maxBarSize={dense ? 26 : 44}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="analytics-chart-caption">Выручка агента по дням</figcaption>
    </figure>
  );
}

function PoliciesChart({ points }: { points: DailyPoint[] }) {
  const gradId = `polGrad-${useId().replace(/:/g, '')}`;

  if (points.length === 0) {
    return (
      <p className="empty-hint empty-hint--chart">Нет данных за выбранный период.</p>
    );
  }

  const data: ChartRow[] = points.map((p) => ({
    ...p,
    revenueNum: parseRev(p.revenue),
  }));

  const { dense, bottom, chartH, xTickFormatter } = chartLayout(data.length);

  return (
    <figure className="analytics-chart-figure">
      <div className="analytics-recharts" role="img" aria-label="Диаграмма числа полисов по дням">
        <ResponsiveContainer width="100%" height={chartH} minHeight={240}>
          <BarChart
            data={data}
            margin={{ top: 12, right: 10, left: 6, bottom }}
            barCategoryGap={dense ? '8%' : '14%'}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="var(--success)" stopOpacity={0.2} />
                <stop offset="45%" stopColor="var(--success)" stopOpacity={0.82} />
                <stop offset="100%" stopColor="var(--success)" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--border)" strokeOpacity={0.85} />
            <XAxis
              dataKey="day"
              tickFormatter={xTickFormatter}
              tick={{ fill: 'var(--fg-muted)', fontSize: dense ? 11 : 12, fontWeight: 600 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-strong)' }}
              interval="preserveStartEnd"
              minTickGap={dense ? 20 : 36}
              angle={dense ? -40 : 0}
              dy={dense ? 8 : 0}
              textAnchor={dense ? 'end' : 'middle'}
              height={dense ? 40 : 20}
            />
            <YAxis
              allowDecimals={false}
              tickFormatter={(v) => String(Math.round(Number(v)))}
              tick={{ fill: 'var(--fg-muted)', fontSize: 11, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ fill: 'var(--bg-subtle)', opacity: 0.95 }}
              content={<PoliciesTooltip />}
              wrapperStyle={{ outline: 'none' }}
            />
            <Bar
              dataKey="policiesCount"
              name="Полисы"
              fill={`url(#${gradId})`}
              radius={[8, 8, 0, 0]}
              maxBarSize={dense ? 26 : 44}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="analytics-chart-caption">Количество оформленных полисов по дням</figcaption>
    </figure>
  );
}

export function AnalyticsPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return localYMD(d);
  });
  const [to, setTo] = useState(() => localYMD(new Date()));
  const [preset, setPreset] = useState<AnalyticsPreset>('custom');
  const [data, setData] = useState<Summary | null>(null);
  const [series, setSeries] = useState<DailyPoint[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDocumentTitle('Аналитика');
  }, []);

  const loadRange = useCallback(async (fromStr: string, toStr: string) => {
    setErr(null);
    setLoading(true);
    const q = new URLSearchParams({ from: fromStr, to: toStr }).toString();
    try {
      const [sum, daily] = await Promise.all([
        api<Summary>(`/analytics/summary?${q}`),
        api<{ points: DailyPoint[] }>(`/analytics/daily?${q}`),
      ]);
      setData(sum);
      setSeries(daily.points);
    } catch (e) {
      setData(null);
      setSeries([]);
      setErr(e instanceof ApiError ? e.message : 'Не удалось загрузить аналитику');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRange(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только начальные from/to
  }, [loadRange]);

  return (
    <div className="page analytics-page">
      <header className="page-header">
        <PageHeading title="Аналитика" hint="Сводка по выручке агента" />
      </header>

      {err && (
        <p className="form-error page-alert" role="alert">
          {err}
        </p>
      )}

      {data && !err && (
        <div className="metric-grid">
          <div className="metric">
            <p className="metric-label">Выручка агента</p>
            <p className="metric-value">{moneyFmt.format(parseRev(data.revenue))} ₽</p>
            <RevenueDelta pct={data.revenueDeltaPct ?? null} currentRevenue={data.revenue} />
          </div>
          <div className="metric">
            <p className="metric-label">Полисов</p>
            <p className="metric-value">{data.policiesCount}</p>
            <PoliciesDelta pct={data.policiesDeltaPct ?? null} currentCount={data.policiesCount} />
          </div>
          <PreviousPeriodPanel
            days={data.periodDays}
            revenue={data.prevRevenue}
            policiesCount={data.prevPoliciesCount}
            prevFrom={data.prevFrom}
            prevTo={data.prevTo}
          />
        </div>
      )}

      <section className="card analytics-dynamics-card">
        <div className="analytics-dynamics-toolbar">
          <h2 className="card-title analytics-dynamics-title">Динамика по дням</h2>
          <div className="analytics-dynamics-toolbar__period">
            <AnalyticsPeriodPicker
              from={from}
              to={to}
              preset={preset}
              loading={loading}
              onApply={(f, t, pr) => {
                setFrom(f);
                setTo(t);
                setPreset(pr);
                void loadRange(f, t);
              }}
              presetToday={presetToday}
              presetYesterday={presetYesterday}
              presetWeek={presetWeek}
              presetMonth={presetMonthCalendar}
              formatRangeLabel={formatPeriodButtonLabel}
            />
          </div>
        </div>

        {loading && !data && !err && (
          <p className="empty-hint empty-hint--chart analytics-dynamics-placeholder">Загрузка…</p>
        )}

        {data && !err && (
          <div className="analytics-charts-grid">
            <div className="analytics-chart-panel">
              <h3 className="analytics-chart-panel-title">Выручка</h3>
              <RevenueChart points={series} />
            </div>
            <div className="analytics-chart-panel">
              <h3 className="analytics-chart-panel-title">Полисы</h3>
              <PoliciesChart points={series} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
