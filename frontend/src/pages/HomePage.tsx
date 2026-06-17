import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Modal } from '../components/Modal';
import { NotificationToasts } from '../components/NotificationToasts';
import { PageHeading } from '../components/PageHeading';
import { PolicyForm } from '../components/PolicyForm';
import { RenewalTaskModal, type RenewalTaskRow } from '../components/RenewalTaskModal';
import { formatRenewalTaskDisplay, renewalTaskDeadlineClass } from '../domain/renewal-task-display';
import { RENEWAL_STATUS_LABELS, renewalStatusBadgeClass } from '../domain/renewal-task-status';
import { setDocumentTitle } from '../utils/documentTitle';

type Notif = { id: string; message: string; type: string };

/** Длительность показа одного тоста, мс (5–10 с). */
function toastVisibleMs(): number {
  return 5000 + Math.floor(Math.random() * 5001);
}

type PolicyDialog = null | { mode: 'create' };

async function loadHomeData(): Promise<{ tasks: RenewalTaskRow[]; notifs: Notif[] }> {
  const [tasks, notifs] = await Promise.all([
    api<RenewalTaskRow[]>('/home/renewal-tasks'),
    api<Notif[]>('/home/notifications'),
  ]);
  return { tasks, notifs };
}

export function HomePage() {
  const { me } = useAuth();
  const [tasks, setTasks] = useState<RenewalTaskRow[]>([]);
  const [toastItems, setToastItems] = useState<{ id: string; message: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [policyDialog, setPolicyDialog] = useState<PolicyDialog>(null);
  const [selectedTask, setSelectedTask] = useState<RenewalTaskRow | null>(null);
  const toastScheduledRef = useRef(new Set<string>());
  /** В браузере setTimeout возвращает number; не используем NodeJS.Timeout. */
  const toastTimersRef = useRef(new Map<string, number>());
  const toastItemsRef = useRef(toastItems);
  toastItemsRef.current = toastItems;

  useEffect(() => {
    setDocumentTitle('Главная');
  }, []);

  const scheduleNotificationToasts = useCallback((notifs: Notif[]) => {
    for (const n of notifs) {
      if (toastScheduledRef.current.has(n.id)) continue;
      toastScheduledRef.current.add(n.id);
      setToastItems((prev) => [...prev, { id: n.id, message: n.message }]);
      const delayMs = toastVisibleMs();
      const timer = window.setTimeout(async () => {
        toastTimersRef.current.delete(n.id);
        try {
          await api(`/home/notifications/${n.id}/ack`, { method: 'POST' });
        } catch {
          /* при ошибке уведомление останется непрочитанным — при следующей загрузке тост покажется снова */
        } finally {
          toastScheduledRef.current.delete(n.id);
          setToastItems((prev) => prev.filter((t) => t.id !== n.id));
        }
      }, delayMs);
      toastTimersRef.current.set(n.id, timer);
    }
  }, []);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((t) => window.clearTimeout(t));
      toastTimersRef.current.clear();
      toastItemsRef.current.forEach(({ id }) => {
        void api(`/home/notifications/${id}/ack`, { method: 'POST' });
      });
    };
  }, []);

  const reload = useCallback(async () => {
    try {
      const { tasks, notifs } = await loadHomeData();
      setTasks(tasks);
      scheduleNotificationToasts(notifs);
    } catch {
      setErr('Не удалось загрузить главную');
    }
  }, [scheduleNotificationToasts]);

  useEffect(() => {
    let cancelled = false;
    void loadHomeData()
      .then(({ tasks, notifs }) => {
        if (cancelled) return;
        setTasks(tasks);
        scheduleNotificationToasts(notifs);
      })
      .catch(() => {
        if (!cancelled) setErr('Не удалось загрузить главную');
      });
    return () => {
      cancelled = true;
    };
  }, [scheduleNotificationToasts]);

  const canAddPolicy =
    me?.role === 'SUPER_ADMIN' || me?.role === 'SUPER_MANAGER' || me?.role === 'MANAGER';

  return (
    <div className="page">
      <NotificationToasts items={toastItems} />

      <header className="page-header">
        <PageHeading title="Главная" hint="Задачи и быстрые действия по полисам." />
        {canAddPolicy && (
          <div className="page-actions">
            <button type="button" className="btn btn--primary" onClick={() => setPolicyDialog({ mode: 'create' })}>
              Добавить полис
            </button>
          </div>
        )}
      </header>

      {err && (
        <p className="form-error page-alert" role="alert">
          {err}
        </p>
      )}

      <RenewalTaskModal
        task={selectedTask}
        open={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
        onUpdated={() => void reload()}
      />

      <Modal
        open={policyDialog !== null}
        onClose={() => setPolicyDialog(null)}
        title="Новый полис"
        size="lg"
      >
        {policyDialog ? (
          <PolicyForm
            key="create"
            onSuccess={() => {
              setPolicyDialog(null);
              void reload();
            }}
            onCancel={() => setPolicyDialog(null)}
          />
        ) : null}
      </Modal>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Задачи</h2>
        </div>
        <div className="data-table-wrap">
          <table className="data-table data-table--task-rows">
            <thead>
              <tr>
                <th>Статус</th>
                <th>Клиент</th>
                <th>Телефон</th>
                <th>Полис</th>
                <th>Объект страхования</th>
                <th>До окончания</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr className="data-table__empty-row">
                  <td colSpan={6}>
                    <p className="empty-hint empty-hint--in-cell">Нет активных задач.</p>
                  </td>
                </tr>
              ) : (
                tasks.map((t) => (
                  <tr
                    key={t.taskId}
                    className="data-table__click-row"
                    onClick={() => setSelectedTask(t)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedTask(t);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Открыть задачу"
                  >
                    <td>
                      <span className={renewalStatusBadgeClass(t.status)}>
                        {RENEWAL_STATUS_LABELS[t.status]}
                      </span>
                    </td>
                    <td>
                      {t.client.lastName} {t.client.firstName} {t.client.middleName ?? ''}
                    </td>
                    <td>{t.client.phone}</td>
                    <td>
                      {t.policy.companyName} / {t.policy.productName}
                    </td>
                    <td>{t.policy.insuredObject?.trim() || '—'}</td>
                    <td>
                      <span className={renewalTaskDeadlineClass(t.display)}>
                        {formatRenewalTaskDisplay(t.display)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
