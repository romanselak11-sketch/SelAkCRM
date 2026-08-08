import { useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../api';
import { formatIsoDateRu } from '../utils/formatters';
import { DEFAULT_LIST_PAGE_SIZE, type ListPageSize } from '../utils/listPagination';
import { EmptyHint } from './EmptyHint';
import { FormError } from './FormActions';
import { ListPaginationFooter } from './ListPaginationFooter';
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
  const [policyPageSize, setPolicyPageSize] = useState<ListPageSize>(DEFAULT_LIST_PAGE_SIZE);

  const requestKey =
    open && client && canViewPolicies
      ? `${client.id}:${reloadNonce}:${policyPage}:${policyPageSize}`
      : null;

  useEffect(() => {
    if (!requestKey || !client) return;
    let cancelled = false;
    void api<ClientPoliciesResponse>(
      `/clients/${client.id}/policies?page=${policyPage}&pageSize=${policyPageSize}`,
    )
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
                <EmptyHint variant="inCard">Телефоны не указаны. Добавьте номер при редактировании клиента.</EmptyHint>
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
              <EmptyHint variant="inCard">Полисы доступны только руководителям.</EmptyHint>
            ) : requestKey !== null && result.key !== requestKey ? (
              <EmptyHint variant="inCard">Загрузка полисов…</EmptyHint>
            ) : result.error ? (
              <FormError>{result.error}</FormError>
            ) : result.policies.length === 0 ? (
              <EmptyHint variant="inCard">У клиента пока нет полисов.</EmptyHint>
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
                        <span className="client-details__policy-meta-value">
                          {formatIsoDateRu(policy.endDate)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {canViewPolicies ? (
              <ListPaginationFooter
                total={result.total}
                page={policyPage}
                limit={policyPageSize}
                onPageChange={setPolicyPage}
                onLimitChange={(l) => {
                  setPolicyPageSize(l);
                  setPolicyPage(1);
                }}
                navAriaLabel="Страницы полисов клиента"
              />
            ) : null}
          </section>
        </div>
      )}
    </Modal>
  );
}
