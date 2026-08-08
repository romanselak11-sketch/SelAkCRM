import type { AnalyticsSummary } from '../domain/analytics';
import { formatDeltaPct, parseRevenue } from '../domain/analytics';
import { LabelCaps, SurfacePanel } from './SurfacePanel';

const moneyFmt = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function ymdToDdMmYyyy(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${pad2(d)}.${pad2(m)}.${y}`;
}

function DeltaBadge({ pct }: { pct: number | null }) {
  const d = formatDeltaPct(pct);
  return (
    <span className={`analytics-kpi__delta analytics-kpi__delta--${d.kind}`} title="К прошлому периоду">
      {d.kind === 'up' ? '↑ ' : d.kind === 'down' ? '↓ ' : ''}
      {d.text}
    </span>
  );
}

type AnalyticsKpiStripProps = {
  data: AnalyticsSummary;
  loading?: boolean;
};

export function AnalyticsKpiStrip({ data, loading }: AnalyticsKpiStripProps) {
  const avg =
    data.avgAgentIncome != null ? `${moneyFmt.format(parseRevenue(data.avgAgentIncome))} ₽` : '—';

  return (
    <section className="analytics-kpi-section" aria-busy={loading || undefined}>
      <div className="analytics-kpi-strip">
        <SurfacePanel as="article" className="analytics-kpi">
          <LabelCaps className="analytics-kpi__label">Выручка агента</LabelCaps>
          <p className="analytics-kpi__value">{moneyFmt.format(parseRevenue(data.revenue))} ₽</p>
          <DeltaBadge pct={data.revenueDeltaPct} />
        </SurfacePanel>
        <SurfacePanel as="article" className="analytics-kpi">
          <LabelCaps className="analytics-kpi__label">Полисов</LabelCaps>
          <p className="analytics-kpi__value">{data.policiesCount}</p>
          <DeltaBadge pct={data.policiesDeltaPct} />
        </SurfacePanel>
        <SurfacePanel as="article" className="analytics-kpi">
          <LabelCaps className="analytics-kpi__label">Средний чек</LabelCaps>
          <p className="analytics-kpi__value">{avg}</p>
          <span className="analytics-kpi__delta analytics-kpi__delta--flat">за полис</span>
        </SurfacePanel>
      </div>
      <p className="analytics-kpi-compare">
        Сравнение с {ymdToDdMmYyyy(data.prevFrom)}–{ymdToDdMmYyyy(data.prevTo)} ({data.periodDays} дн.)
      </p>
    </section>
  );
}

export function AnalyticsKpiSkeleton() {
  return (
    <div className="analytics-kpi-strip analytics-kpi-strip--skeleton" aria-hidden>
      <SurfacePanel className="analytics-kpi analytics-skel" />
      <SurfacePanel className="analytics-kpi analytics-skel" />
      <SurfacePanel className="analytics-kpi analytics-skel" />
    </div>
  );
}
