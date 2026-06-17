import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import {
  RENEWAL_STATUS_LABELS,
  canActOnRenewalTask,
  canEditRenewedRenewalTask,
  renewalStatusBadgeClass,
  resolveRenewalTaskEditablePolicyId,
  type RenewalTaskStatusApi,
} from '../domain/renewal-task-status';
import {
  formatRenewalTaskDisplay,
  isRenewalTaskCompleted,
  renewalTaskDeadlineClass,
  type RenewalTaskDisplay,
} from '../domain/renewal-task-display';
import { formatIsoDateRu, formatMoneyRu } from '../utils/formatters';
import { toLocalYMD } from '../utils/localDate';
import { DateField } from './DateField';
import { Modal } from './Modal';
import { PolicyForm } from './PolicyForm';
import { ValidatedTextarea } from './ValidatedTextarea';
import { RenewalTaskCommentHistory } from './RenewalTaskCommentHistory';
import type { RenewalTaskCommentEntry } from '../domain/renewal-task-comments';

export type RenewalTaskRow = {
  taskId: string;
  policyId: string;
  status: RenewalTaskStatusApi;
  display: RenewalTaskDisplay;
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
  renewedPolicyId?: string | null;
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
  /** Заполняется при статусе «Ожидание обратной связи». */
  feedbackComment?: string | null;
  /** Заполняется при статусе «Отложена». */
  postponeComment?: string | null;
  commentHistory?: RenewalTaskCommentEntry[];
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

type View = 'main' | 'renew' | 'editRenewed' | 'postponeSimple' | 'postponeFeedback' | 'decline';

type RenewalTaskModalProps = {
  task: RenewalTaskRow | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
};

export function RenewalTaskModal({ task, open, onClose, onUpdated }: RenewalTaskModalProps) {
  const { me } = useAuth();
  const [view, setView] = useState<View>('main');
  const [dateYmd, setDateYmd] = useState(todayYmd);
  const [timeHm, setTimeHm] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [postponeComment, setPostponeComment] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setView('main');
      setDateYmd(todayYmd());
      setTimeHm('');
      setDeclineReason('');
      setFeedbackComment('');
      setPostponeComment('');
      setErr(null);
    }
  }, [open, task?.taskId]);

  if (!task) return null;

  const canActOnTask = canActOnRenewalTask(task.status);
  const editablePolicyId = resolveRenewalTaskEditablePolicyId(task);
  const canEditRenewed =
    task.status === 'RENEWED' &&
    editablePolicyId &&
    canEditRenewedRenewalTask(me?.role);

  const deadlineLabel = isRenewalTaskCompleted(task.display) ? 'Завершена' : 'До окончания';
  const untilLabel = formatRenewalTaskDisplay(task.display);

  async function submitPostpone(mode: 'simple' | 'feedback') {
    if (!task) return;
    setErr(null);
    const c = (mode === 'feedback' ? feedbackComment : postponeComment).trim();
    if (c.length === 0 || c.length > 1000) {
      setErr(
        mode === 'feedback'
          ? 'Укажите комментарий: что ждём от клиента (1–1000 символов)'
          : 'Укажите комментарий к отсрочке (1–1000 символов)'
      );
      return;
    }
    setBusy(true);
    try {
      const until = buildUntilIso(dateYmd, timeHm || undefined);
      const body = { mode, until, comment: c };
      await api(`/home/renewal-tasks/${task.taskId}/postpone`, {
        method: 'POST',
        body: JSON.stringify(body),
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
      : view === 'editRenewed'
        ? 'Редактирование полиса'
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
      size={view === 'renew' || view === 'editRenewed' ? 'lg' : 'md'}
      disableBackdropClose={view === 'renew' || view === 'editRenewed'}
      bodyClassName={view === 'main' ? 'modal-body--renewal-task' : undefined}
    >
      {view === 'main' && (
        <div className="renewal-task-modal renewal-task-modal--main">
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
              <strong>{deadlineLabel}:</strong>{' '}
              <span className={renewalTaskDeadlineClass(task.display)}>{untilLabel}</span>
            </p>
            {task.commentHistory && task.commentHistory.length > 0 ? (
              <RenewalTaskCommentHistory entries={task.commentHistory} />
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
          {canEditRenewed ? (
            <div className="renewal-task-modal__actions">
              <button type="button" className="btn btn--primary" onClick={() => setView('editRenewed')}>
                Редактировать полис
              </button>
            </div>
          ) : null}
        </div>
      )}

      {view === 'postponeSimple' && (
        <div className="renewal-task-modal__form">
          <label className="field">
            <span className="field-label">Комментарий к отсрочке</span>
            <ValidatedTextarea
              value={postponeComment}
              onChange={setPostponeComment}
              maxLength={1000}
              rows={4}
              required
              placeholder="Например: перезвонить после отпуска, уточнить условия у руководства…"
            />
          </label>
          <label className="field">
            <span className="field-label">Напомнить после (дата)</span>
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
              onClick={() => void submitPostpone('simple')}
            >
              Сохранить
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setView('main')} disabled={busy}>
              Назад
            </button>
          </div>
        </div>
      )}

      {view === 'postponeFeedback' && (
        <div className="renewal-task-modal__form">
          <label className="field">
            <span className="field-label">Что ждём от клиента</span>
            <ValidatedTextarea
              value={feedbackComment}
              onChange={setFeedbackComment}
              maxLength={1000}
              rows={4}
              required
              placeholder="Например: подтверждение суммы, документы, решение по продлению…"
            />
          </label>
          <label className="field">
            <span className="field-label">Напомнить после (дата)</span>
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
              onClick={() => void submitPostpone('feedback')}
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

      {view === 'editRenewed' && editablePolicyId ? (
        <PolicyForm
          key={`edit-${editablePolicyId}`}
          policyId={editablePolicyId}
          onSuccess={() => {
            onUpdated();
            onClose();
          }}
          onCancel={() => setView('main')}
        />
      ) : null}
    </Modal>
  );
}
