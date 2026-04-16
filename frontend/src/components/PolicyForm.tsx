import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { DateField } from './DateField';
import { ScrollableChoiceList } from './ScrollableChoiceList';

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
};

type PolicyDetail = {
  clientId: string;
  companyId: string;
  productId: string;
  number: string;
  insuranceSumS?: string | number | null;
  premiumPercent?: string | number | null;
  premiumRubles: string | number;
  endDate: string;
};

export type PolicyFormProps = {
  taskId?: string;
  initialClientId?: string;
  /** Редактирование существующего полиса (только SUPER_ADMIN / SUPER_MANAGER, маршрут /policies) */
  policyId?: string;
  onSuccess: () => void;
  onCancel: () => void;
};

export function PolicyForm({
  taskId,
  initialClientId,
  policyId,
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
  const [insuranceSumS, setInsuranceSumS] = useState('');
  const [premiumPercent, setPremiumPercent] = useState('');
  const [premiumRubles, setPremiumRubles] = useState('0');
  const [endDate, setEndDate] = useState(defaultEndDateYmd);
  const [err, setErr] = useState<string | null>(null);
  const [refsErr, setRefsErr] = useState<string | null>(null);

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
    void api<PolicyDetail>(`/policies/${policyId}`).then((pol) => {
      if (cancelled) return;
      setClientId(pol.clientId);
      setCompanyId(pol.companyId);
      setProductId(pol.productId);
      setNumber(pol.number);
      setInsuranceSumS(
        pol.insuranceSumS !== null && pol.insuranceSumS !== undefined && pol.insuranceSumS !== ''
          ? String(pol.insuranceSumS)
          : '',
      );
      setPremiumPercent(
        pol.premiumPercent !== null &&
          pol.premiumPercent !== undefined &&
          pol.premiumPercent !== ''
          ? String(pol.premiumPercent)
          : '',
      );
      setPremiumRubles(String(pol.premiumRubles ?? '0'));
      setEndDate(pol.endDate.slice(0, 10));
    });
    return () => {
      cancelled = true;
    };
  }, [policyId]);

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
        const pct =
          p.defaultPremiumPct !== null &&
          p.defaultPremiumPct !== undefined &&
          p.defaultPremiumPct !== ''
            ? ` — ${p.defaultPremiumPct}%`
            : '';
        return { value: p.id, label: `${p.name}${pct}` };
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
      insuranceSumS: insuranceSumS || undefined,
      premiumPercent: premiumPercent || undefined,
      premiumRubles: premiumRubles || '0',
      endDate,
    };
    try {
      if (policyId) {
        await api(`/policies/${policyId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            number,
            insuranceSumS: insuranceSumS,
            premiumPercent,
            premiumRubles: premiumRubles || '0',
            endDate,
          }),
        });
      } else if (taskId) {
        await api(`/home/renewal-tasks/${taskId}/renew`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
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

  const refsLocked = Boolean(policyId);
  const clientLocked = refsLocked || Boolean(taskId);

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <label className="field">
        <span className="field-label">Клиент</span>
        <ScrollableChoiceList
          value={clientId}
          onChange={setClientId}
          options={clientOptions}
          placeholder="Выберите клиента"
          disabled={clientLocked}
        />
      </label>
      <label className="field">
        <span className="field-label">Компания</span>
        <ScrollableChoiceList
          value={companyId}
          onChange={onCompanyChange}
          options={companyOptions}
          placeholder="Выберите компанию"
          disabled={refsLocked}
        />
      </label>
      <label className="field">
        <span className="field-label">Продукт</span>
        <ScrollableChoiceList
          value={productId}
          onChange={onProductChange}
          options={productOptions}
          placeholder="Выберите продукт"
          disabled={refsLocked}
        />
      </label>
      <label className="field">
        <span className="field-label">Номер полиса</span>
        <input value={number} onChange={(e) => setNumber(e.target.value)} required />
      </label>
      <label className="field">
        <span className="field-label">Стоимость полиса</span>
        <input value={insuranceSumS} onChange={(e) => setInsuranceSumS(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Комиссия агента в %</span>
        <input value={premiumPercent} onChange={(e) => setPremiumPercent(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Дополнительная комиссия</span>
        <input value={premiumRubles} onChange={(e) => setPremiumRubles(e.target.value)} />
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
          Сохранить
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}
