/** Типы и форматтеры аналитики. */

export type AnalyticsDailyPoint = {
  day: string;
  revenue: string;
  policiesCount: number;
};

export type AnalyticsSummary = {
  revenue: string;
  policiesCount: number;
  avgAgentIncome: string | null;
  prevRevenue: string;
  prevPoliciesCount: number;
  periodDays: number;
  prevFrom: string;
  prevTo: string;
  revenueDeltaPct: number | null;
  policiesDeltaPct: number | null;
};

export type AnalyticsBreakdownItem = {
  id: string | null;
  name: string;
  revenue: string;
  policiesCount: number;
};

export type AnalyticsBreakdowns = {
  byUser: AnalyticsBreakdownItem[];
  byCompany: AnalyticsBreakdownItem[];
  byProduct: AnalyticsBreakdownItem[];
};

export type AnalyticsRenewals = {
  openCount: number;
  overdueCount: number;
  renewedInPeriod: number;
  declinedInPeriod: number;
  conversionPct: number | null;
};

/** '' = все сотрудники, иначе userId */
export type EmployeeFilterValue = '' | (string & {});

/** Максимум дней в периоде аналитики (год + 1 день запаса). */
export const ANALYTICS_MAX_PERIOD_DAYS = 367;

export function parseRevenue(s: string): number {
  return Number(s) || 0;
}

/** Число календарных дней в диапазоне включительно (локальные YYYY-MM-DD). */
export function analyticsPeriodDayCount(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split('-').map(Number);
  const [ty, tm, td] = toYmd.split('-').map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return 0;
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return Math.floor((hi - lo) / 86_400_000) + 1;
}

export function isAnalyticsPeriodTooLong(fromYmd: string, toYmd: string): boolean {
  return analyticsPeriodDayCount(fromYmd, toYmd) > ANALYTICS_MAX_PERIOD_DAYS;
}

export function buildAnalyticsQuery(params: {
  from: string;
  to: string;
  employee: EmployeeFilterValue;
  companyId: string;
  productId: string;
}): string {
  const q = new URLSearchParams({ from: params.from, to: params.to });
  if (params.employee) q.set('userId', params.employee);
  if (params.companyId) q.set('companyId', params.companyId);
  if (params.productId) q.set('productId', params.productId);
  return q.toString();
}

export function formatDeltaPct(pct: number | null): { kind: 'up' | 'down' | 'flat' | 'fromZero'; text: string } {
  if (pct === null) {
    return { kind: 'fromZero', text: 'от нуля' };
  }
  const n = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(pct);
  if (pct > 0) return { kind: 'up', text: `${n}%` };
  if (pct < 0) return { kind: 'down', text: `${n}%` };
  return { kind: 'flat', text: '0%' };
}
