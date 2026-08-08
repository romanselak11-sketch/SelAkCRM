import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api';
import { AnalyticsBreakdownPanel } from '../components/AnalyticsBreakdownPanel';
import { AnalyticsDailyChart } from '../components/AnalyticsDailyChart';
import { AnalyticsKpiSkeleton, AnalyticsKpiStrip } from '../components/AnalyticsKpiStrip';
import type { AnalyticsPreset } from '../components/AnalyticsPeriodPicker';
import { AnalyticsRenewalsStrip } from '../components/AnalyticsRenewalsStrip';
import {
  AnalyticsToolbar,
  type CompanyOption,
  type EmployeeOption,
} from '../components/AnalyticsToolbar';
import { Card, CardTitle } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { EmptyHint } from '../components/EmptyHint';
import { FormError } from '../components/FormActions';
import type {
  AnalyticsBreakdowns,
  AnalyticsDailyPoint,
  AnalyticsRenewals,
  AnalyticsSummary,
  EmployeeFilterValue,
} from '../domain/analytics';
import { buildAnalyticsQuery, parseRevenue } from '../domain/analytics';
import { setDocumentTitle } from '../utils/documentTitle';
import {
  presetMonthCalendar,
  presetToday,
  presetWeek,
  presetYesterday,
  toLocalYMD,
} from '../utils/localDate';

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function ymdToDdMmYyyy(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${pad2(d)}.${pad2(m)}.${y}`;
}

function formatPeriodButtonLabel(fromYmd: string, toYmd: string) {
  return `${ymdToDdMmYyyy(fromYmd)} — ${ymdToDdMmYyyy(toYmd)}`;
}

type UserRow = { id: string; login: string; isActive: boolean };
type CompanyRow = {
  id: string;
  name: string;
  products?: { id: string; name: string }[];
};

export function AnalyticsPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return toLocalYMD(d);
  });
  const [to, setTo] = useState(() => toLocalYMD(new Date()));
  const [preset, setPreset] = useState<AnalyticsPreset>('custom');
  const [employee, setEmployee] = useState<EmployeeFilterValue>('');
  const [companyId, setCompanyId] = useState('');
  const [productId, setProductId] = useState('');

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);

  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [series, setSeries] = useState<AnalyticsDailyPoint[]>([]);
  const [breakdowns, setBreakdowns] = useState<AnalyticsBreakdowns | null>(null);
  const [renewals, setRenewals] = useState<AnalyticsRenewals | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDocumentTitle('Аналитика');
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      api<UserRow[]>('/users'),
      api<{ items: CompanyRow[] }>('/insurance-companies?page=1&limit=50'),
    ])
      .then(([users, comps]) => {
        if (cancelled) return;
        setEmployees(
          users
            .filter((u) => u.isActive)
            .map((u) => ({ id: u.id, login: u.login, isActive: u.isActive })),
        );
        setCompanies(
          comps.items.map((c) => ({
            id: c.id,
            name: c.name,
            products: (c.products ?? []).map((p) => ({ id: p.id, name: p.name })),
          })),
        );
      })
      .catch(() => {
        /* фильтры опциональны при ошибке справочников */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const employeeOptions = useMemo(() => {
    if (!employee) return employees;
    if (employees.some((e) => e.id === employee)) return employees;
    return [...employees, { id: employee, login: employee, isActive: false }];
  }, [employees, employee]);

  const selectedLogin = useMemo(() => {
    if (!employee) return null;
    return employeeOptions.find((e) => e.id === employee)?.login ?? null;
  }, [employee, employeeOptions]);

  const loadRange = useCallback(
    async (fromStr: string, toStr: string, emp: EmployeeFilterValue, cid: string, pid: string) => {
      setErr(null);
      setLoading(true);
      const q = buildAnalyticsQuery({
        from: fromStr,
        to: toStr,
        employee: emp,
        companyId: cid,
        productId: pid,
      });
      try {
        const [sum, daily, br, rn] = await Promise.all([
          api<AnalyticsSummary>(`/analytics/summary?${q}`),
          api<{ points: AnalyticsDailyPoint[] }>(`/analytics/daily?${q}`),
          api<AnalyticsBreakdowns>(`/analytics/breakdowns?${q}`),
          api<AnalyticsRenewals>(`/analytics/renewals?${q}`),
        ]);
        setData(sum);
        setSeries(daily.points);
        setBreakdowns(br);
        setRenewals(rn);
      } catch (e) {
        setData(null);
        setSeries([]);
        setBreakdowns(null);
        setRenewals(null);
        setErr(e instanceof ApiError ? e.message : 'Не удалось загрузить аналитику');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadRange(from, to, employee, companyId, productId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial + filter-driven via handlers
  }, [loadRange]);

  function reload(next?: {
    from?: string;
    to?: string;
    preset?: AnalyticsPreset;
    employee?: EmployeeFilterValue;
    companyId?: string;
    productId?: string;
  }) {
    const f = next?.from ?? from;
    const t = next?.to ?? to;
    const emp = next?.employee ?? employee;
    const cid = next?.companyId ?? companyId;
    let pid = next?.productId ?? productId;
    if (next?.companyId !== undefined && next.companyId !== companyId) {
      pid = next.productId ?? '';
    }
    if (next?.from != null) setFrom(next.from);
    if (next?.to != null) setTo(next.to);
    if (next?.preset != null) setPreset(next.preset);
    if (next?.employee != null) setEmployee(next.employee);
    if (next?.companyId != null) setCompanyId(next.companyId);
    if (next?.productId != null || (next?.companyId !== undefined && next.companyId !== companyId)) {
      setProductId(pid);
    }
    void loadRange(f, t, emp, cid, pid);
  }

  const heading = selectedLogin ? `Аналитика · ${selectedLogin}` : 'Аналитика';

  const renewalsHint = selectedLogin
    ? `По задачам на полисах, оформленных сотрудником ${selectedLogin}`
    : null;

  const chartEmpty = Boolean(data && parseRevenue(data.revenue) === 0 && data.policiesCount === 0);
  const showByUser = !employee;

  return (
    <div className="page analytics-page">
      <PageHeader title={heading} hint="Сводка по выручке агента, срезы и задачи продления" />

      <AnalyticsToolbar
        from={from}
        to={to}
        preset={preset}
        loading={loading}
        employee={employee}
        companyId={companyId}
        productId={productId}
        employees={employeeOptions}
        companies={companies}
        onPeriodApply={(f, t, pr) => reload({ from: f, to: t, preset: pr })}
        onEmployeeChange={(v) => reload({ employee: v as EmployeeFilterValue })}
        onCompanyChange={(v) => reload({ companyId: v, productId: '' })}
        onProductChange={(v) => reload({ productId: v })}
        onReset={() => {
          const month = (() => {
            const d = new Date();
            d.setMonth(d.getMonth() - 1);
            return toLocalYMD(d);
          })();
          const today = toLocalYMD(new Date());
          setFrom(month);
          setTo(today);
          setPreset('custom');
          setEmployee('');
          setCompanyId('');
          setProductId('');
          void loadRange(month, today, '', '', '');
        }}
        presetToday={presetToday}
        presetYesterday={presetYesterday}
        presetWeek={presetWeek}
        presetMonth={presetMonthCalendar}
        formatRangeLabel={formatPeriodButtonLabel}
      />

      <FormError className="page-alert">{err}</FormError>

      {loading && !data && !err ? <AnalyticsKpiSkeleton /> : null}
      {data && !err ? <AnalyticsKpiStrip data={data} loading={loading} /> : null}

      <Card className="analytics-dynamics-card" aria-busy={loading || undefined}>
        <CardTitle className="analytics-dynamics-title">Динамика по дням</CardTitle>
        {loading && !data && !err ? (
          <EmptyHint variant="chart" className="analytics-dynamics-placeholder">
            Загрузка…
          </EmptyHint>
        ) : null}
        {data && !err ? <AnalyticsDailyChart points={series} empty={chartEmpty} /> : null}
      </Card>

      {breakdowns && !err ? (
        <div className="analytics-breakdowns-grid">
          {showByUser ? (
            <AnalyticsBreakdownPanel title="По сотрудникам" items={breakdowns.byUser} />
          ) : null}
          <AnalyticsBreakdownPanel title="По страховым компаниям" items={breakdowns.byCompany} />
          <AnalyticsBreakdownPanel title="По продуктам" items={breakdowns.byProduct} />
        </div>
      ) : null}

      {renewals && !err ? <AnalyticsRenewalsStrip data={renewals} scopedHint={renewalsHint} /> : null}
    </div>
  );
}
