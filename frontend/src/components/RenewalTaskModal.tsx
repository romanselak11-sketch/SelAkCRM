import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import {
  canActOnRenewalTask,
  canEditRenewedRenewalTask,
  canRenewRenewalTask,
  isRenewalTaskEditPrimary,
  resolveRenewalTaskEditablePolicyId,
  type RenewalTaskStatusApi,
} from '../domain/renewal-task-status';
import {
  formatRenewalTaskDisplay,
  isRenewalTaskCompleted,
  renewalTaskDeadlineClass,
  type RenewalTaskDisplay,
} from '../domain/renewal-task-display';
import { formatDateTimeRu, formatIsoDateRu, formatMoneyRu } from '../utils/formatters';
import { toLocalYMD } from '../utils/localDate';
import { DateField } from './DateField';
import { Btn } from './Btn';
import { FieldLabel } from './FieldLabel';
import { FormActions, FormError } from './FormActions';
import { Modal } from './Modal';
import { PolicyForm } from './PolicyForm';
import { TaskStatusBadge } from './TaskStatusBadge';
import { ValidatedTextarea } from './ValidatedTextarea';
import { RenewalTaskCommentHistory } from './RenewalTaskCommentHistory';
import type { RenewalTaskCommentEntry } from '../domain/renewal-task-comments';
import { renewalTaskCommentPreview } from '../domain/renewal-task-comment-preview';

export type RenewalTaskRow = {
  taskId: string;
  policyId: string;
  status: RenewalTaskStatusApi;
  display: RenewalTaskDisplay;
  /** Номер задачи в реестре (если пришёл с API). */
  taskNumber?: number;
  createdAt?: string;
  statusChangedAt?: string;
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

type View = 'main' | 'edit' | 'renew' | 'editRenewed' | 'postponeSimple' | 'postponeFeedback' | 'decline';

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
  const canRenew = canRenewRenewalTask(task.status);
  const editablePolicyId = resolveRenewalTaskEditablePolicyId(task);
  const canEditPolicy = Boolean(editablePolicyId) && canEditRenewedRenewalTask(me);
  const editIsPrimary = canEditPolicy && isRenewalTaskEditPrimary(task.status);
  const renewIsPrimary = canRenew && !editIsPrimary;

  const deadlineLabel = isRenewalTaskCompleted(task.display) ? 'Завершена' : 'До окончания';
  const untilLabel = formatRenewalTaskDisplay(task.display);
  const activeComment = renewalTaskCommentPreview(task);
  const activeCommentLabel = 'Комментарий';

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

  const canEnterEdit = canActOnTask || canEditPolicy;
  const taskSubtitle = `${task.client.lastName} ${task.client.firstName} · полис ${task.policy.number}`;

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
              : view === 'edit'
                ? 'Редактирование задачи'
                : 'Задача';

  const description = view === 'main' || view === 'edit' ? taskSubtitle : undefined;

  const summary = (
    <div className="renewal-task-modal__summary">
      {task.taskNumber != null ? (
        <p className="renewal-task-modal__line">
          <strong>№:</strong> {task.taskNumber}
        </p>
      ) : null}
      {task.createdAt ? (
        <p className="renewal-task-modal__line">
          <strong>Создана:</strong> {formatDateTimeRu(task.createdAt)}
        </p>
      ) : null}
      <p className="renewal-task-modal__line">
        <strong>Статус:</strong> <TaskStatusBadge status={task.status} />
      </p>
      {task.statusChangedAt ? (
        <p className="renewal-task-modal__line">
          <strong>Статус изменён:</strong> {formatDateTimeRu(task.statusChangedAt)}
        </p>
      ) : null}
      <p className="renewal-task-modal__line">
        <strong>Клиент:</strong> {task.client.lastName} {task.client.firstName}{' '}
        {task.client.middleName ?? ''}
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
        <strong>Дата окончания полиса:</strong> {formatIsoDateRu(task.policy.endDate)}
      </p>
      <p className="renewal-task-modal__line">
        <strong>Стоимость полиса:</strong>{' '}
        {task.policy.insuranceSumS ? formatMoneyRu(task.policy.insuranceSumS) : '—'}
      </p>
      <p className="renewal-task-modal__line">
        <strong>{deadlineLabel}:</strong>{' '}
        <span className={renewalTaskDeadlineClass(task.display)}>{untilLabel}</span>
      </p>
      <p className="renewal-task-modal__line">
        <strong>Новый полис:</strong>{' '}
        {task.renewedPolicy
          ? `${task.renewedPolicy.number} · ${task.renewedPolicy.companyName} / ${task.renewedPolicy.productName}`
          : '—'}
      </p>
      <p className="renewal-task-modal__line renewal-task-modal__line--multiline">
        <strong>{activeCommentLabel}:</strong> {activeComment}
      </p>
      {task.commentHistory && task.commentHistory.length > 0 ? (
        <RenewalTaskCommentHistory entries={task.commentHistory} />
      ) : null}
      {task.renewedPolicy ? (
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
            {task.renewedPolicy.issueDate ? formatIsoDateRu(task.renewedPolicy.issueDate) : '—'}
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
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={view === 'renew' || view === 'editRenewed' ? 'lg' : 'md'}
      disableBackdropClose={view === 'renew' || view === 'editRenewed'}
      bodyClassName={view === 'main' || view === 'edit' ? 'modal-body--renewal-task' : undefined}
    >
      {view === 'main' && (
        <div className="renewal-task-modal renewal-task-modal--main">
          {summary}
          {canEnterEdit ? (
            <div className="renewal-task-modal__actions">
              <Btn variant="primary" onClick={() => setView('edit')}>
                Редактировать
              </Btn>
            </div>
          ) : null}
        </div>
      )}

      {view === 'edit' && (
        <div className="renewal-task-modal renewal-task-modal--main">
          {summary}
          <div className="renewal-task-modal__actions">
            {canActOnTask ? (
              <>
                <Btn variant="ghost" onClick={() => setView('postponeSimple')}>
                  Отложить
                </Btn>
                <Btn variant="ghost" onClick={() => setView('postponeFeedback')}>
                  Ожидание обратной связи
                </Btn>
                {canRenew ? (
                  <Btn
                    variant={renewIsPrimary ? 'primary' : 'ghost'}
                    onClick={() => setView('renew')}
                  >
                    Продлить полис
                  </Btn>
                ) : null}
                <Btn variant="danger-soft" onClick={() => setView('decline')}>
                  Клиент отказался
                </Btn>
              </>
            ) : null}
            {canEditPolicy ? (
              <Btn
                variant={editIsPrimary ? 'primary' : 'ghost'}
                onClick={() => setView('editRenewed')}
              >
                Редактировать полис
              </Btn>
            ) : null}
            <Btn variant="ghost" onClick={() => setView('main')}>
              Назад
            </Btn>
          </div>
        </div>
      )}

      {view === 'postponeSimple' && (
        <div className="renewal-task-modal__form">
          <label className="field">
            <FieldLabel hint="Зачем откладываем">Комментарий к отсрочке</FieldLabel>
            <ValidatedTextarea
              value={postponeComment}
              onChange={setPostponeComment}
              maxLength={1000}
              rows={4}
              required
            />
          </label>
          <label className="field">
            <FieldLabel hint="Дата следующего касания">Напомнить после (дата)</FieldLabel>
            <DateField value={dateYmd} onChange={setDateYmd} min={toLocalYMD(new Date())} />
          </label>
          <label className="field">
            <FieldLabel hint="По умолчанию 09:00">Время (необязательно)</FieldLabel>
            <input
              type="time"
              value={timeHm}
              onChange={(e) => setTimeHm(e.target.value)}
              className="input-numeric-no-spin"
            />
          </label>
          <FormError>{err}</FormError>
          <FormActions>
            <Btn variant="primary" disabled={busy} onClick={() => void submitPostpone('simple')}>
              Сохранить
            </Btn>
            <Btn variant="ghost" onClick={() => setView('edit')} disabled={busy}>
              Назад
            </Btn>
          </FormActions>
        </div>
      )}

      {view === 'postponeFeedback' && (
        <div className="renewal-task-modal__form">
          <label className="field">
            <FieldLabel hint="Что нужно получить">Что ждём от клиента</FieldLabel>
            <ValidatedTextarea
              value={feedbackComment}
              onChange={setFeedbackComment}
              maxLength={1000}
              rows={4}
              required
            />
          </label>
          <label className="field">
            <FieldLabel hint="Дата следующего касания">Напомнить после (дата)</FieldLabel>
            <DateField value={dateYmd} onChange={setDateYmd} min={toLocalYMD(new Date())} />
          </label>
          <label className="field">
            <FieldLabel hint="По умолчанию 09:00">Время (необязательно)</FieldLabel>
            <input
              type="time"
              value={timeHm}
              onChange={(e) => setTimeHm(e.target.value)}
              className="input-numeric-no-spin"
            />
          </label>
          <FormError>{err}</FormError>
          <FormActions>
            <Btn variant="primary" disabled={busy} onClick={() => void submitPostpone('feedback')}>
              Сохранить
            </Btn>
            <Btn variant="ghost" onClick={() => setView('edit')} disabled={busy}>
              Назад
            </Btn>
          </FormActions>
        </div>
      )}

      {view === 'decline' && (
        <form className="renewal-task-modal__form" onSubmit={submitDecline}>
          <label className="field">
            <FieldLabel hint="Почему отказался">Причина отказа клиента</FieldLabel>
            <ValidatedTextarea
              value={declineReason}
              onChange={setDeclineReason}
              maxLength={1000}
              rows={5}
              required
            />
          </label>
          <FormError>{err}</FormError>
          <FormActions>
            <Btn variant="danger-soft" type="submit" disabled={busy}>
              Закрыть задачу с отказом
            </Btn>
            <Btn variant="ghost" onClick={() => setView('edit')} disabled={busy}>
              Назад
            </Btn>
          </FormActions>
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
          onCancel={() => setView('edit')}
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
          onCancel={() => setView('edit')}
        />
      ) : null}
    </Modal>
  );
}
