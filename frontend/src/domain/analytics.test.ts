import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_MAX_PERIOD_DAYS,
  analyticsPeriodDayCount,
  buildAnalyticsQuery,
  formatDeltaPct,
  isAnalyticsPeriodTooLong,
  parseRevenue,
} from './analytics';

describe('buildAnalyticsQuery', () => {
  it('добавляет userId для сотрудника', () => {
    const q = buildAnalyticsQuery({
      from: '2026-01-01',
      to: '2026-01-31',
      employee: 'u1',
      companyId: '',
      productId: '',
    });
    expect(q).toContain('userId=u1');
    expect(q).not.toContain('unattributed');
  });

  it('ставит companyId без unattributed', () => {
    const q = buildAnalyticsQuery({
      from: '2026-01-01',
      to: '2026-01-31',
      employee: '',
      companyId: 'c1',
      productId: '',
    });
    expect(q).toContain('companyId=c1');
    expect(q).not.toContain('unattributed');
    expect(q).not.toContain('userId');
  });
});

describe('formatDeltaPct', () => {
  it('различает рост и падение', () => {
    expect(formatDeltaPct(12.5).kind).toBe('up');
    expect(formatDeltaPct(-3).kind).toBe('down');
    expect(formatDeltaPct(0).kind).toBe('flat');
    expect(formatDeltaPct(null).kind).toBe('fromZero');
  });
});

describe('parseRevenue', () => {
  it('парсит строку', () => {
    expect(parseRevenue('12.5')).toBe(12.5);
    expect(parseRevenue('')).toBe(0);
  });
});

describe('analytics period length', () => {
  it('считает дни включительно', () => {
    expect(analyticsPeriodDayCount('2026-01-01', '2026-01-01')).toBe(1);
    expect(analyticsPeriodDayCount('2026-01-01', '2026-01-02')).toBe(2);
    expect(analyticsPeriodDayCount('2026-01-02', '2026-01-01')).toBe(2);
  });

  it('ограничивает 367 днями', () => {
    expect(ANALYTICS_MAX_PERIOD_DAYS).toBe(367);
    // 2026-01-01…2027-01-02 = 367 дн. (2026 не високосный)
    expect(analyticsPeriodDayCount('2026-01-01', '2027-01-02')).toBe(367);
    expect(isAnalyticsPeriodTooLong('2026-01-01', '2027-01-02')).toBe(false);
    expect(isAnalyticsPeriodTooLong('2026-01-01', '2027-01-03')).toBe(true);
  });
});
