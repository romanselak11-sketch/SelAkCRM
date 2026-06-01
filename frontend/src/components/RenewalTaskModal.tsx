import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../api';
import {
  RENEWAL_STATUS_LABELS,
  canActOnRenewalTask,
  renewalStatusBadgeClass,
  type RenewalTaskStatusApi,
} from '../domain/renewal-task-status';
import { formatIsoDateRu, formatMoneyRu } from '../utils/formatters';
import { toLocalYMD } from '../utils/localDate';
import { DateField } from './DateField';
import { Modal } from './Modal';
import { PolicyForm } from './PolicyForm';
import { ValidatedTextarea } from './ValidatedTextarea';

export type RenewalTaskRow = {
  taskId: string;
  policyId: string;
  status: RenewalTaskStatusApi;
  display: { kind: 'days'; value: number } | { kind: 'hm'; value: string };
  client: {
    id: string;
    lastName: string;
    firstName: string;
    middleName?: string | null;
    phone: string;
    documentsUrl?: string | null;
  };
  policy: {
    number: string;
    endDate: string;
    companyName: string;
    productName: string;
    insuredObject?: string | null;
    insuranceSumS: string | null;
  };
  /** Новый полис после продления (статус «Завершена»). */
  renewedPolicy?: {
    id: string;
    number: string;
    endDate: string;
    issueDate?: string | null;
    companyName: string;
    productName: string;
    insuredObject?: string | null;
    insuranceSumS: string | null;
    premiumRubles?: string | null;
  } | null;
  /** Заполняется при статусе «Отказ клиента». */
  declineReason?: string | null;
};

function todayYmd(): string {
  return toLocalYMD(new Date());
}

/** Локальная дата + опционально время → ISO для API */
function buildUntilIso(dateYmd: string, timeHm: string | undefined): string {
  const [y, mo, d] = dateYmd.split('-').map(Number);
  let hh = 9;
  let mm = 0;
  if (timeHm && /^\d{2}:\d{2}$/.test(timeHm)) {
    const [h, m] = timeHm.split(':').map(Number);
    hh = h;
    mm = m;
  }
  const dt = new Date(y, mo - 1, d, hh, mm, 0, 0);
  return dt.toISOString();
}

type View = 'main' | 'renew' | 'postponeSimple' | 'postponeFeedback' | 'decline';

type RenewalTaskModalProps = {
  task: RenewalTaskRow | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
};

export function RenewalTaskModal({ task, open, onClose, onUpdated }: RenewalTaskModalProps) {
  const [view, setView] = useState<View>('main');
  const [dateYmd, setDateYmd] = useState(todayYmd);
  const [timeHm, setTimeHm] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setView('main');
      setDateYmd(todayYmd());
      setTimeHm('');
      setDeclineReason('');
      setErr(null);
    }
  }, [open, task?.taskId]);

  if (!task) return null;

  const canActOnTask = canActOnRenewalTask(task.status);

  const untilLabel =
    task.display.kind === 'days' ? `${task.display.value} дн.` : task.display.value;

  async function submitPostpone(mode: 'simple' | 'feedback') {
    if (!task) return;
    setErr(null);
    setBusy(true);
    try {
      const until = buildUntilIso(dateYmd, timeHm || undefined);
      await api(`/home/renewal-tasks/${task.taskId}/postpone`, {
        method: 'POST',
        body: JSON.stringify({ mode, until }),
      });
      onUpdated();
      onClose();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : 'Не удалось отложить');
    } finally {
      setBusy(false);
    }
  }

  async function submitDecline(e: FormEvent) {
    e.preventDefault();
    if (!task) return;
    setErr(null);
    const r = declineReason.trim();
    if (r.length === 0 || r.length > 1000) {
      setErr('Укажите причину отказа (1–1000 символов)');
      return;
    }
    setBusy(true);
    try {
      await api(`/home/renewal-tasks/${task.taskId}/decline`, {
        method: 'POST',
        body: JSON.stringify({ reason: r }),
      });
      onUpdated();
      onClose();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }

  const title =
    view === 'renew'
      ? 'Продление полиса'
      : view === 'postponeSimple'
        ? 'Отложить задачу'
        : view === 'postponeFeedback'
          ? 'Ожидание обратной связи'
          : view === 'decline'
            ? 'Отказ клиента'
            : 'Задача';

  const description =
    view === 'main'
      ? `${task.client.lastName} ${task.client.firstName} · полис ${task.policy.number}`
      : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={view === 'renew' ? 'lg' : 'md'}
      disableBackdropClose={view === 'renew'}
    >
      {view === 'main' && (
        <div className="renewal-task-modal">
          <div className="renewal-task-modal__summary">
            <p className="renewal-task-modal__line">
              <strong>Статус:</strong>{' '}
              <span className={renewalStatusBadgeClass(task.status)}>
                {RENEWAL_STATUS_LABELS[task.status]}
              </span>
            </p>
            <p className="renewal-task-modal__line">
              <strong>Телефон:</strong> {task.client.phone}
            </p>
            <p className="renewal-task-modal__line">
              <strong>Полис:</strong> {task.policy.number} · {task.policy.companyName} /{' '}
              {task.policy.productName}
            </p>
            <p className="renewal-task-modal__line">
              <strong>Объект страхования:</strong> {task.policy.insuredObject?.trim() || '—'}
            </p>
            <p className="renewal-task-modal__line">
              <strong>До окончания:</strong> {untilLabel}
            </p>
            {task.status === 'CLIENT_DECLINED' && task.declineReason ? (
              <p className="renewal-task-modal__line renewal-task-modal__line--multiline">
                <strong>Причина отказа:</strong> {task.declineReason}
              </p>
            ) : null}
            {task.status === 'RENEWED' && task.renewedPolicy ? (
              <div className="renewal-task-modal__renewed-block">
                <p className="renewal-task-modal__line">
                  <strong>Оформленный полис:</strong> {task.renewedPolicy.number}
                </p>
                <p className="renewal-task-modal__line">
                  <strong>Компания / продукт:</strong> {task.renewedPolicy.companyName} /{' '}
                  {task.renewedPolicy.productName}
                </p>
                <p className="renewal-task-modal__line">
                  <strong>Объект страхования:</strong>{' '}
                  {task.renewedPolicy.insuredObject?.trim() || '—'}
                </p>
                <p className="renewal-task-modal__line">
                  <strong>Дата оформления:</strong>{' '}
                  {task.renewedPolicy.issueDate
                    ? formatIsoDateRu(task.renewedPolicy.issueDate)
                    : '—'}
                </p>
                <p className="renewal-task-modal__line">
                  <strong>Дата окончания:</strong> {formatIsoDateRu(task.renewedPolicy.endDate)}
                </p>
                <p className="renewal-task-modal__line">
                  <strong>Стоимость полиса:</strong>{' '}
                  {task.renewedPolicy.insuranceSumS
                    ? formatMoneyRu(task.renewedPolicy.insuranceSumS)
                    : '—'}
                </p>
              </div>
            ) : null}
          </div>
          {canActOnTask ? (
            <div className="renewal-task-modal__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setView('postponeSimple')}>
                Отложить
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setView('postponeFeedback')}
              >
                Ожидание обратной связи
              </button>
              <button type="button" className="btn btn--primary" onClick={() => setView('renew')}>
                Продлить полис
              </button>
              <button type="button" className="btn btn--danger-soft" onClick={() => setView('decline')}>
                Клиент отказался
              </button>
            </div>
          ) : null}
        </div>
      )}

      {(view === 'postponeSimple' || view === 'postponeFeedback') && (
        <div className="renewal-task-modal__form">
          <label className="field">
            <span className="field-label">Дата</span>
            <DateField value={dateYmd} onChange={setDateYmd} min={toLocalYMD(new Date())} />
          </label>
          <label className="field">
            <span className="field-label">Время (необязательно)</span>
            <input
              type="time"
              value={timeHm}
              onChange={(e) => setTimeHm(e.target.value)}
              className="input-numeric-no-spin"
            />
            <span className="field-hint">Если не указать — 09:00</span>
          </label>
          {err ? (
            <p className="form-error" role="alert">
              {err}
            </p>
          ) : null}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={() =>
                void submitPostpone(view === 'postponeFeedback' ? 'feedback' : 'simple')
              }
            >
              Сохранить
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setView('main')} disabled={busy}>
              Назад
            </button>
          </div>
        </div>
      )}

      {view === 'decline' && (
        <form className="renewal-task-modal__form" onSubmit={submitDecline}>
          <label className="field">
            <span className="field-label">Причина отказа клиента</span>
            <ValidatedTextarea
              value={declineReason}
              onChange={setDeclineReason}
              maxLength={1000}
              rows={5}
              required
              placeholder="Кратко опишите причину…"
            />
          </label>
          {err ? (
            <p className="form-error" role="alert">
              {err}
            </p>
          ) : null}
          <div className="form-actions">
            <button type="submit" className="btn btn--danger-soft" disabled={busy}>
              Закрыть задачу с отказом
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setView('main')} disabled={busy}>
              Назад
            </button>
          </div>
        </form>
      )}

      {view === 'renew' && (
        <PolicyForm
          key={`${task.taskId}-${task.client.id}`}
          taskId={task.taskId}
          initialClientId={task.client.id}
          onSuccess={() => {
            onUpdated();
            onClose();
          }}
          onCancel={() => setView('main')}
        />
      )}
    </Modal>
  );
}
