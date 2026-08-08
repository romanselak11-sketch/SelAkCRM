import { useMemo } from 'react';
import type { AnalyticsPreset } from './AnalyticsPeriodPicker';
import { AnalyticsPeriodPicker } from './AnalyticsPeriodPicker';
import { Btn } from './Btn';
import { LabelCaps, SurfacePanel } from './SurfacePanel';
import { ScrollableChoiceList } from './ScrollableChoiceList';

export type EmployeeOption = { id: string; login: string; isActive: boolean };
export type CompanyOption = { id: string; name: string; products: { id: string; name: string }[] };

type AnalyticsToolbarProps = {
  from: string;
  to: string;
  preset: AnalyticsPreset;
  loading: boolean;
  employee: string;
  companyId: string;
  productId: string;
  employees: EmployeeOption[];
  companies: CompanyOption[];
  onPeriodApply: (from: string, to: string, preset: AnalyticsPreset) => void;
  onEmployeeChange: (value: string) => void;
  onCompanyChange: (value: string) => void;
  onProductChange: (value: string) => void;
  onReset: () => void;
  presetToday: () => { from: string; to: string };
  presetYesterday: () => { from: string; to: string };
  presetWeek: () => { from: string; to: string };
  presetMonth: () => { from: string; to: string };
  formatRangeLabel: (fromYmd: string, toYmd: string) => string;
};

export function AnalyticsToolbar({
  from,
  to,
  preset,
  loading,
  employee,
  companyId,
  productId,
  employees,
  companies,
  onPeriodApply,
  onEmployeeChange,
  onCompanyChange,
  onProductChange,
  onReset,
  presetToday,
  presetYesterday,
  presetWeek,
  presetMonth,
  formatRangeLabel,
}: AnalyticsToolbarProps) {
  const selectedCompany = companies.find((c) => c.id === companyId);
  const products = selectedCompany?.products ?? [];

  const employeeChoices = useMemo(
    () =>
      employees.map((u) => ({
        value: u.id,
        label: u.isActive ? u.login : `${u.login} (неактивен)`,
      })),
    [employees],
  );

  const companyChoices = useMemo(
    () => companies.map((c) => ({ value: c.id, label: c.name })),
    [companies],
  );

  const productChoices = useMemo(
    () => products.map((p) => ({ value: p.id, label: p.name })),
    [products],
  );

  return (
    <SurfacePanel pad className="analytics-toolbar" role="search" aria-label="Фильтры аналитики">
      <div className="analytics-toolbar__row">
        <div className="analytics-toolbar__field analytics-toolbar__field--period">
          <LabelCaps id="analytics-filter-period">Период</LabelCaps>
          <AnalyticsPeriodPicker
            from={from}
            to={to}
            preset={preset}
            loading={loading}
            onApply={onPeriodApply}
            presetToday={presetToday}
            presetYesterday={presetYesterday}
            presetWeek={presetWeek}
            presetMonth={presetMonth}
            formatRangeLabel={formatRangeLabel}
          />
        </div>
        <div className="analytics-toolbar__field">
          <LabelCaps id="analytics-filter-employee">Сотрудник</LabelCaps>
          <ScrollableChoiceList
            value={employee}
            onChange={onEmployeeChange}
            options={employeeChoices}
            placeholder="Все сотрудники"
            disabled={loading}
            searchable={employees.length > 8}
            searchPlaceholder="Найти сотрудника…"
          />
        </div>
        <div className="analytics-toolbar__field">
          <LabelCaps id="analytics-filter-company">СК</LabelCaps>
          <ScrollableChoiceList
            value={companyId}
            onChange={onCompanyChange}
            options={companyChoices}
            placeholder="Все компании"
            disabled={loading}
            searchable={companies.length > 8}
            searchPlaceholder="Найти компанию…"
          />
        </div>
        <div className="analytics-toolbar__field">
          <LabelCaps id="analytics-filter-product">Продукт</LabelCaps>
          <ScrollableChoiceList
            value={productId}
            onChange={onProductChange}
            options={productChoices}
            placeholder={companyId ? 'Все продукты' : 'Сначала выберите СК'}
            disabled={loading || !companyId}
            searchable={products.length > 8}
            searchPlaceholder="Найти продукт…"
          />
        </div>
        <div className="analytics-toolbar__actions">
          <Btn variant="ghost" disabled={loading} onClick={onReset}>
            Сбросить
          </Btn>
        </div>
      </div>
    </SurfacePanel>
  );
}
