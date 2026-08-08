import type { AnalyticsBreakdownItem } from '../domain/analytics';
import { parseRevenue } from '../domain/analytics';
import { Card } from './Card';
import { EmptyHint } from './EmptyHint';

const moneyFmt = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

type AnalyticsBreakdownPanelProps = {
  title: string;
  items: AnalyticsBreakdownItem[];
};

export function AnalyticsBreakdownPanel({ title, items }: AnalyticsBreakdownPanelProps) {
  const max = Math.max(1, ...items.map((i) => parseRevenue(i.revenue)));

  return (
    <Card className="analytics-breakdown" aria-label={title}>
      <h3 className="analytics-breakdown__title">{title}</h3>
      {items.length === 0 ? (
        <EmptyHint>Нет разбивки за выбранный период. Измените фильтры или период.</EmptyHint>
      ) : (
        <ul className="analytics-breakdown__list">
          {items.map((item, idx) => {
            const rev = parseRevenue(item.revenue);
            const pct = Math.round((rev / max) * 100);
            return (
              <li key={`${item.id ?? 'null'}-${idx}`} className="analytics-breakdown__row">
                <div className="analytics-breakdown__head">
                  <span className="analytics-breakdown__name">{item.name}</span>
                  <span className="analytics-breakdown__meta">
                    {moneyFmt.format(rev)} ₽ · {item.policiesCount}
                  </span>
                </div>
                <div className="analytics-breakdown__bar" aria-hidden>
                  <span style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
