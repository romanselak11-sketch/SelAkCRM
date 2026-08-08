import type { AnalyticsRenewals } from '../domain/analytics';
import { Card, CardTitle } from './Card';
import { LabelCaps, SurfacePanel } from './SurfacePanel';

type AnalyticsRenewalsStripProps = {
  data: AnalyticsRenewals;
  scopedHint?: string | null;
};

export function AnalyticsRenewalsStrip({ data, scopedHint }: AnalyticsRenewalsStripProps) {
  return (
    <Card className="analytics-renewals" aria-label="Задачи">
      <div className="analytics-renewals__head">
        <CardTitle>Задачи</CardTitle>
        {scopedHint ? <p className="analytics-renewals__hint">{scopedHint}</p> : null}
      </div>
      <div className="analytics-renewals__grid">
        <SurfacePanel as="article" className="analytics-kpi analytics-kpi--compact">
          <LabelCaps className="analytics-kpi__label">Открытые</LabelCaps>
          <p className="analytics-kpi__value">{data.openCount}</p>
        </SurfacePanel>
        <SurfacePanel as="article" className="analytics-kpi analytics-kpi--compact">
          <LabelCaps className="analytics-kpi__label">Просроченные</LabelCaps>
          <p className="analytics-kpi__value">{data.overdueCount}</p>
        </SurfacePanel>
        <SurfacePanel as="article" className="analytics-kpi analytics-kpi--compact">
          <LabelCaps className="analytics-kpi__label">Продлено</LabelCaps>
          <p className="analytics-kpi__value">{data.renewedInPeriod}</p>
        </SurfacePanel>
        <SurfacePanel as="article" className="analytics-kpi analytics-kpi--compact">
          <LabelCaps className="analytics-kpi__label">Отказы</LabelCaps>
          <p className="analytics-kpi__value">{data.declinedInPeriod}</p>
        </SurfacePanel>
        <SurfacePanel as="article" className="analytics-kpi analytics-kpi--compact">
          <LabelCaps className="analytics-kpi__label">Конверсия</LabelCaps>
          <p className="analytics-kpi__value">
            {data.conversionPct == null ? '—' : `${data.conversionPct}%`}
          </p>
        </SurfacePanel>
      </div>
    </Card>
  );
}
