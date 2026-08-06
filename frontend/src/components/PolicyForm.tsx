import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { formatMoneyForField, normalizeMoneyForApi } from '../utils/moneyInput';
import { ClientCreateModal, type CreatedClient } from './ClientCreateModal';
import { DateField } from './DateField';
import { ScrollableChoiceList } from './ScrollableChoiceList';
import { ValidatedInput } from './ValidatedInput';

function defaultEndDateYmd(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

type RefOpt = { id: string; name?: string; lastName?: string; firstName?: string };

type ProductOpt = {
  id: string;
  name: string;
  defaultPremiumPct?: string | number | null;
  defaultPremiumRubles?: string | number | null;
};

type PolicyDetail = {
  clientId: string;
  companyId: string;
  productId: string;
  number: string;
  insuredObject?: string | null;
  insuranceSumS?: string | number | null;
  premiumPercent?: string | number | null;
  premiumRubles: string | number;
  issueDate?: string | null;
  endDate: string;
};

export type PolicyFormProps = {
  taskId?: string;
  initialClientId?: string;
  /** Редактирование существующего полиса (только SUPER_ADMIN / SUPER_MANAGER, маршрут /policies) */
  policyId?: string;
  /** Создание задачи продления с новым полисом (раздел «Задачи»). */
  createManualTask?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
};

type ChoiceOption = { value: string; label: string };

function PolicyFormClientField({
  clientId,
  clientOptions,
  onClientChange,
  clientCreateOpen,
  onClientCreateOpen,
  onClientCreateClose,
  appendClient,
}: {
  clientId: string;
  clientOptions: ChoiceOption[];
  onClientChange: (value: string) => void;
  clientCreateOpen: boolean;
  onClientCreateOpen: () => void;
  onClientCreateClose: () => void;
  appendClient: (created: CreatedClient) => void;
}) {
  return (
    <>
      <div className="field">
        <span className="field-label">Клиент</span>
        <div className="choice-field-row">
          <ScrollableChoiceList
            value={clientId}
            onChange={onClientChange}
            options={clientOptions}
            placeholder="Выберите клиента"
            searchable
            searchPlaceholder="Введите имя клиента"
            emptySearchText="Клиенты не найдены"
          />
          <button
            type="button"
            className="btn btn--ghost choice-field-row__add"
            title="Новый клиент"
            aria-label="Новый клиент"
            onClick={onClientCreateOpen}
          >
            +
          </button>
        </div>
      </div>
      <ClientCreateModal
        open={clientCreateOpen}
        onClose={onClientCreateClose}
        onCreated={appendClient}
        createPath="/home/policy-form/clients"
      />
    </>
  );
}

export function PolicyForm({
  taskId,
  initialClientId,
  policyId,
  createManualTask = false,
  onSuccess,
  onCancel,
}: PolicyFormProps) {
  const { me } = useAuth();
  const [clients, setClients] = useState<RefOpt[]>([]);
  const [companies, setCompanies] = useState<RefOpt[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [clientId, setClientId] = useState(initialClientId ?? '');
  const [companyId, setCompanyId] = useState('');
  const [productId, setProductId] = useState('');
  const [number, setNumber] = useState('');
  const [insuredObject, setInsuredObject] = useState('');
  const [insuranceSumS, setInsuranceSumS] = useState('');
  const [premiumPercent, setPremiumPercent] = useState('');
  const [premiumRubles, setPremiumRubles] = useState('0');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(defaultEndDateYmd);
  const [err, setErr] = useState<string | null>(null);
  const [refsErr, setRefsErr] = useState<string | null>(null);
  const [clientCreateOpen, setClientCreateOpen] = useState(false);

  const applyDefaultPremiumForProduct = useCallback(
    (pid: string, list: ProductOpt[]) => {
      if (policyId) return;
      const p = list.find((x) => x.id === pid);
      if (!p) return;
      const d = p.defaultPremiumPct;
      if (d !== null && d !== undefined && d !== '') {
        setPremiumPercent(String(d));
      } else {
        setPremiumPercent('');
      }
      const rub = p.defaultPremiumRubles;
      if (rub !== null && rub !== undefined && rub !== '') {
        setPremiumRubles(formatMoneyForField(rub));
      } else {
        setPremiumRubles('0');
      }
    },
    [policyId],
  );

  useEffect(() => {
    const pf = '/home/policy-form';
    void Promise.all([
      api<RefOpt[]>(`${pf}/clients`).then(setClients),
      api<{ id: string; name: string }[]>(`${pf}/companies`).then((c) =>
        setCompanies(c.map((x) => ({ id: x.id, name: x.name }))),
      ),
    ]).catch((ex) => {
      setClients([]);
      setCompanies([]);
      setRefsErr(ex instanceof ApiError ? ex.message : 'Не удалось загрузить справочники');
    });
  }, []);

  useEffect(() => {
    if (!companyId) return;
    const path = `/home/policy-form/companies/${companyId}/products`;
    void api<ProductOpt[]>(path)
      .then(setProducts)
      .catch((ex) => {
        setProducts([]);
        setProductId('');
        setRefsErr(ex instanceof ApiError ? ex.message : 'Не удалось загрузить продукты');
      });
  }, [companyId]);

  function onCompanyChange(next: string) {
    setCompanyId(next);
    setProductId('');
    setProducts([]);
  }

  function onProductChange(next: string) {
    setProductId(next);
    applyDefaultPremiumForProduct(next, products);
  }

  useEffect(() => {
    if (!policyId) return;
    let cancelled = false;
    void api<PolicyDetail>(`/policies/${policyId}`)
      .then((pol) => {
        if (cancelled) return;
        setClientId(pol.clientId);
        setCompanyId(pol.companyId);
        setProductId(pol.productId);
        setNumber(pol.number);
        setInsuredObject(pol.insuredObject ?? '');
        setInsuranceSumS(
          pol.insuranceSumS !== null && pol.insuranceSumS !== undefined && pol.insuranceSumS !== ''
            ? formatMoneyForField(pol.insuranceSumS)
            : '',
        );
        setPremiumPercent(
          pol.premiumPercent !== null &&
            pol.premiumPercent !== undefined &&
            pol.premiumPercent !== ''
            ? String(pol.premiumPercent)
            : '',
        );
        setPremiumRubles(formatMoneyForField(pol.premiumRubles));
        setIssueDate((pol.issueDate ?? pol.endDate).slice(0, 10));
        setEndDate(pol.endDate.slice(0, 10));
      })
      .catch((ex) => {
        if (cancelled) return;
        setErr(ex instanceof ApiError ? ex.message : 'Не удалось загрузить полис');
      });
    return () => {
      cancelled = true;
    };
  }, [policyId]);

  function appendClient(c: CreatedClient) {
    setClients((prev) => {
      const next = [
        ...prev.filter((x) => x.id !== c.id),
        {
          id: c.id,
          lastName: c.lastName,
          firstName: c.firstName,
          middleName: c.middleName,
        },
      ];
      next.sort((a, b) => {
        const ln = (a.lastName ?? '').localeCompare(b.lastName ?? '', 'ru');
        if (ln !== 0) return ln;
        return (a.firstName ?? '').localeCompare(b.firstName ?? '', 'ru');
      });
      return next;
    });
    setClientId(c.id);
    setClientCreateOpen(false);
  }

  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        value: c.id,
        label: `${c.lastName ?? ''} ${c.firstName ?? ''}`.trim() || c.id,
      })),
    [clients],
  );

  const companyOptions = useMemo(
    () => companies.map((c) => ({ value: c.id, label: c.name ?? c.id })),
    [companies],
  );

  const productOptions = useMemo(
    () =>
      products.map((p) => {
        const parts: string[] = [];
        if (
          p.defaultPremiumPct !== null &&
          p.defaultPremiumPct !== undefined &&
          p.defaultPremiumPct !== ''
        ) {
          parts.push(`${p.defaultPremiumPct}%`);
        }
        if (
          p.defaultPremiumRubles !== null &&
          p.defaultPremiumRubles !== undefined &&
          p.defaultPremiumRubles !== ''
        ) {
          parts.push(`${formatMoneyForField(p.defaultPremiumRubles)} ₽`);
        }
        const suffix = parts.length > 0 ? ` — ${parts.join(', ')}` : '';
        return { value: p.id, label: `${p.name}${suffix}` };
      }),
    [products],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!policyId && (!clientId || !companyId || !productId)) {
      setErr('Выберите клиента, страховую компанию и продукт');
      return;
    }
    const body = {
      clientId,
      companyId,
      productId,
      number,
      insuredObject,
      insuranceSumS: normalizeMoneyForApi(insuranceSumS) || undefined,
      premiumPercent: premiumPercent || undefined,
      premiumRubles: normalizeMoneyForApi(premiumRubles) || '0.00',
      issueDate,
      endDate,
    };
    try {
      if (policyId) {
        await api(`/policies/${policyId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            clientId,
            companyId,
            productId,
            number,
            insuredObject,
            insuranceSumS: normalizeMoneyForApi(insuranceSumS),
            premiumPercent,
            premiumRubles: normalizeMoneyForApi(premiumRubles) || '0.00',
            issueDate,
            endDate,
          }),
        });
      } else if (taskId) {
        await api(`/home/renewal-tasks/${taskId}/renew`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      } else if (createManualTask) {
        await api('/home/tasks', { method: 'POST', body: JSON.stringify(body) });
      } else if (me?.role === 'MANAGER') {
        await api('/home/policies', { method: 'POST', body: JSON.stringify(body) });
      } else {
        await api('/policies', { method: 'POST', body: JSON.stringify(body) });
      }
      onSuccess();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : 'Ошибка сохранения');
    }
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <PolicyFormClientField
        clientId={clientId}
        clientOptions={clientOptions}
        onClientChange={setClientId}
        clientCreateOpen={clientCreateOpen}
        onClientCreateOpen={() => setClientCreateOpen(true)}
        onClientCreateClose={() => setClientCreateOpen(false)}
        appendClient={appendClient}
      />
      <label className="field">
        <span className="field-label">Компания</span>
        <ScrollableChoiceList
          value={companyId}
          onChange={onCompanyChange}
          options={companyOptions}
          placeholder="Выберите компанию"
        />
      </label>
      <label className="field">
        <span className="field-label">Продукт</span>
        <ScrollableChoiceList
          value={productId}
          onChange={onProductChange}
          options={productOptions}
          placeholder="Выберите продукт"
        />
      </label>
      <label className="field">
        <span className="field-label">Номер полиса</span>
        <ValidatedInput
          kind="text"
          value={number}
          onChange={setNumber}
          hint="Например: D120-0000000245"
          required
        />
      </label>
      <label className="field">
        <span className="field-label">Объект страхования</span>
        <ValidatedInput kind="text" value={insuredObject} onChange={setInsuredObject} required />
      </label>
      <label className="field">
        <span className="field-label">Стоимость полиса</span>
        <ValidatedInput
          kind="money"
          value={insuranceSumS}
          onChange={setInsuranceSumS}
          onBlur={() => setInsuranceSumS((v) => formatMoneyForField(v))}
        />
      </label>
      <label className="field">
        <span className="field-label">Комиссия агента в %</span>
        <ValidatedInput kind="decimal" value={premiumPercent} onChange={setPremiumPercent} />
      </label>
      <label className="field">
        <span className="field-label">Дополнительная комиссия</span>
        <ValidatedInput
          kind="money"
          value={premiumRubles}
          onChange={setPremiumRubles}
          onBlur={() => setPremiumRubles((v) => formatMoneyForField(v))}
        />
      </label>
      <label className="field">
        <span className="field-label">Дата оформления</span>
        <DateField value={issueDate} onChange={setIssueDate} />
      </label>
      <label className="field">
        <span className="field-label">Дата окончания полиса</span>
        <DateField value={endDate} onChange={setEndDate} />
      </label>
      {refsErr ? (
        <p className="form-error" role="alert">
          {refsErr}
        </p>
      ) : null}
      {err ? (
        <p className="form-error" role="alert">
          {err}
        </p>
      ) : null}
      <div className="form-actions">
        <button className="btn btn--primary" type="submit">
          {createManualTask ? 'Создать задачу' : 'Сохранить'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}
