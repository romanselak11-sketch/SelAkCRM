import { useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../api';
import { formatIsoDateRu, formatMoneyRu } from '../utils/formatters';
import { Modal } from './Modal';

type PolicyDetails = {
  id: string;
  number: string;
  insuredObject?: string | null;
  insuranceSumS?: string | number | null;
  premiumRubles?: string | number | null;
  issueDate?: string | null;
  endDate: string;
  client: {
    lastName: string;
    firstName: string;
    middleName?: string | null;
  };
  company: {
    name: string;
  };
  product: {
    name: string;
  };
};

type PolicyDetailsModalProps = {
  open: boolean;
  policyId: string | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (policyId: string) => void;
  reloadNonce?: number;
};

export function PolicyDetailsModal({
  open,
  policyId,
  canEdit,
  onClose,
  onEdit,
  reloadNonce = 0,
}: PolicyDetailsModalProps) {
  const [result, setResult] = useState<{
    key: string | null;
    policy: PolicyDetails | null;
    error: string | null;
  }>({ key: null, policy: null, error: null });

  const requestKey = open && policyId ? `${policyId}:${reloadNonce}` : null;

  useEffect(() => {
    if (!requestKey || !policyId) return;
    let cancelled = false;
    void api<PolicyDetails>(`/policies/${policyId}`)
      .then((res) => {
        if (!cancelled) setResult({ key: requestKey, policy: res, error: null });
      })
      .catch((ex) => {
        if (cancelled) return;
        setResult({
          key: requestKey,
          policy: null,
          error: ex instanceof ApiError ? ex.message : 'Не удалось загрузить полис',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, policyId]);

  const clientName = useMemo(() => {
    if (!result.policy) return '';
    const middle = result.policy.client.middleName?.trim();
    return [result.policy.client.lastName, result.policy.client.firstName, middle].filter(Boolean).join(' ');
  }, [result.policy]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Полис"
      description={
        result.policy
          ? `${result.policy.number} · ${result.policy.company.name} / ${result.policy.product.name}`
          : undefined
      }
      size="md"
    >
      {requestKey !== null && result.key !== requestKey ? (
        <p className="empty-hint empty-hint--in-card">Загрузка полиса…</p>
      ) : result.error ? (
        <p className="form-error" role="alert">
          {result.error}
        </p>
      ) : !result.policy ? (
        <p className="empty-hint empty-hint--in-card">Полис не найден.</p>
      ) : (
        <div className="policy-details">
          <dl className="policy-details__grid">
            <div className="policy-details__row">
              <dt>Номер</dt>
              <dd>{result.policy.number}</dd>
            </div>
            <div className="policy-details__row">
              <dt>Клиент</dt>
              <dd>{clientName}</dd>
            </div>
            <div className="policy-details__row">
              <dt>Компания / продукт</dt>
              <dd>
                {result.policy.company.name} / {result.policy.product.name}
              </dd>
            </div>
            <div className="policy-details__row">
              <dt>Объект страхования</dt>
              <dd>{result.policy.insuredObject?.trim() || '—'}</dd>
            </div>
            <div className="policy-details__row">
              <dt>Дата оформления</dt>
              <dd>{formatIsoDateRu(result.policy.issueDate)}</dd>
            </div>
            <div className="policy-details__row">
              <dt>Дата окончания</dt>
              <dd>{formatIsoDateRu(result.policy.endDate)}</dd>
            </div>
            <div className="policy-details__row">
              <dt>Стоимость полиса</dt>
              <dd>{formatMoneyRu(result.policy.insuranceSumS)}</dd>
            </div>
            <div className="policy-details__row">
              <dt>Премия</dt>
              <dd>{formatMoneyRu(result.policy.premiumRubles)}</dd>
            </div>
          </dl>

          {canEdit ? (
            <div className="form-actions">
              <button type="button" className="btn btn--primary" onClick={() => onEdit(result.policy!.id)}>
                Изменить
              </button>
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Закрыть
              </button>
            </div>
          ) : (
            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Закрыть
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
