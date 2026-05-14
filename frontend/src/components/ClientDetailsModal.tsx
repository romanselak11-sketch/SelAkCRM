import { useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../api';
import { formatIsoDateRu } from '../utils/formatters';
import { Modal } from './Modal';

type ClientPhone = { id: string; phone: string };

export type ClientDetails = {
  id: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  phone: string;
  additionalPhones?: ClientPhone[];
};

type ClientPolicy = {
  id: string;
  number: string;
  insuredObject?: string | null;
  issueDate?: string | null;
  endDate: string;
};

type ClientPoliciesResponse = {
  items: ClientPolicy[];
  total: number;
  page: number;
  pageSize: number;
};

type ClientDetailsModalProps = {
  open: boolean;
  client: ClientDetails | null;
  canViewPolicies: boolean;
  onClose: () => void;
  onOpenPolicy: (policyId: string) => void;
  reloadNonce?: number;
};

const POLICY_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export function ClientDetailsModal({
  open,
  client,
  canViewPolicies,
  onClose,
  onOpenPolicy,
  reloadNonce = 0,
}: ClientDetailsModalProps) {
  const [result, setResult] = useState<{
    key: string | null;
    policies: ClientPolicy[];
    error: string | null;
    total: number;
  }>({ key: null, policies: [], error: null, total: 0 });
  const [policyPage, setPolicyPage] = useState(1);
  const [policyPageSize, setPolicyPageSize] = useState<(typeof POLICY_PAGE_SIZE_OPTIONS)[number]>(20);

  const requestKey =
    open && client && canViewPolicies
      ? `${client.id}:${reloadNonce}:${policyPage}:${policyPageSize}`
      : null;

  useEffect(() => {
    if (!requestKey || !client) return;
    let cancelled = false;
    void api<ClientPoliciesResponse>(`/clients/${client.id}/policies?page=${policyPage}&pageSize=${policyPageSize}`)
      .then((res) => {
        if (cancelled) return;
        setResult({ key: requestKey, policies: res.items, error: null, total: res.total });
      })
      .catch((ex) => {
        if (cancelled) return;
        setResult({
          key: requestKey,
          policies: [],
          error: ex instanceof ApiError ? ex.message : 'Не удалось загрузить полисы клиента',
          total: 0,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, client, policyPage, policyPageSize]);

  const totalPolicyPages = Math.max(1, Math.ceil(result.total / policyPageSize));
  const canGoPrev = policyPage > 1;
  const canGoNext = policyPage < totalPolicyPages;

  const fullName = useMemo(() => {
    if (!client) return '';
    const middle = client.middleName?.trim();
    return [client.lastName, client.firstName, middle].filter(Boolean).join(' ');
  }, [client]);

  const phones = useMemo(() => {
    if (!client) return [];
    const values = [client.phone, ...(client.additionalPhones ?? []).map((x) => x.phone)];
    const normalized = values.map((v) => v.trim()).filter(Boolean);
    return [...new Set(normalized)];
  }, [client]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Карточка клиента"
      description={client ? 'Профиль клиента и связанные полисы.' : undefined}
      size="lg"
    >
      {!client ? null : (
        <div className="client-details">
          <section className="client-details__section">
            <h3 className="client-details__title">{fullName}</h3>
            <div className="client-details__phones">
              <span className="client-details__label">Телефоны</span>
              {phones.length === 0 ? (
                <p className="empty-hint empty-hint--in-card">Нет телефонов</p>
              ) : (
                <ul className="client-details__phone-list">
                  {phones.map((phone) => (
                    <li key={phone} className="client-details__phone-item">
                      {phone}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="client-details__section">
            <div className="client-details__section-head">
              <h4 className="client-details__subtitle">Полисы</h4>
            </div>

            {!canViewPolicies ? (
              <p className="empty-hint empty-hint--in-card">Полисы доступны только руководителям.</p>
            ) : requestKey !== null && result.key !== requestKey ? (
              <p className="empty-hint empty-hint--in-card">Загрузка полисов…</p>
            ) : result.error ? (
              <p className="form-error" role="alert">
                {result.error}
              </p>
            ) : result.policies.length === 0 ? (
              <p className="empty-hint empty-hint--in-card">У клиента пока нет полисов.</p>
            ) : (
              <div className="client-details__policies" role="list" aria-label="Список полисов клиента">
                {result.policies.map((policy) => (
                  <button
                    key={policy.id}
                    type="button"
                    role="listitem"
                    className="client-details__policy-row"
                    onClick={() => onOpenPolicy(policy.id)}
                  >
                    <div className="client-details__policy-top">
                      <span className="client-details__policy-number">{policy.number}</span>
                      <span className="client-details__policy-open">Открыть</span>
                    </div>
                    <p className="client-details__policy-object">
                      {policy.insuredObject?.trim() || 'Объект не указан'}
                    </p>
                    <div className="client-details__policy-meta">
                      <div className="client-details__policy-meta-item">
                        <span className="client-details__policy-meta-label">Оформлен</span>
                        <span className="client-details__policy-meta-value">
                          {formatIsoDateRu(policy.issueDate)}
                        </span>
                      </div>
                      <div className="client-details__policy-meta-item">
                        <span className="client-details__policy-meta-label">Действует до</span>
                        <span className="client-details__policy-meta-value">{formatIsoDateRu(policy.endDate)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {canViewPolicies && (
              <div className="client-details__pagination">
                <label className="client-details__pagination-size">
                  <span>Показывать</span>
                  <select
                    value={policyPageSize}
                    onChange={(e) => {
                      setPolicyPageSize(Number(e.target.value) as (typeof POLICY_PAGE_SIZE_OPTIONS)[number]);
                      setPolicyPage(1);
                    }}
                  >
                    {POLICY_PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="client-details__pagination-controls">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={!canGoPrev || (requestKey !== null && result.key !== requestKey)}
                    onClick={() => setPolicyPage((prev) => Math.max(1, prev - 1))}
                  >
                    Назад
                  </button>
                  <span className="client-details__pagination-meta">
                    Стр. {policyPage} из {totalPolicyPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={!canGoNext || (requestKey !== null && result.key !== requestKey)}
                    onClick={() => setPolicyPage((prev) => Math.min(totalPolicyPages, prev + 1))}
                  >
                    Вперёд
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
