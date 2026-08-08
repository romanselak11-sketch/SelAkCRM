import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { hasPermission } from '../domain/permissions';
import { Modal } from '../components/Modal';
import { Btn } from '../components/Btn';
import { Card, CardHeader } from '../components/Card';
import {
  DataTable,
  DataTableBody,
  DataTableClickRow,
  DataTableEmpty,
  DataTableHead,
  DataTableTd,
  DataTableTh,
} from '../components/DataTable';
import { FormError } from '../components/FormActions';
import { NotificationToasts } from '../components/NotificationToasts';
import { PageHeader } from '../components/PageHeader';
import { PolicyForm } from '../components/PolicyForm';
import { RenewalTaskModal, type RenewalTaskRow } from '../components/RenewalTaskModal';
import { TaskStatusBadge } from '../components/TaskStatusBadge';
import { formatRenewalTaskDisplay, renewalTaskDeadlineClass } from '../domain/renewal-task-display';
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

  const canAddPolicy = hasPermission(me, 'policies.create');

  return (
    <div className="page page--home">
      <NotificationToasts items={toastItems} />

      <PageHeader
        title="Главная"
        hint="Задачи и быстрые действия по полисам."
        actions={
          canAddPolicy ? (
            <Btn variant="primary" onClick={() => setPolicyDialog({ mode: 'create' })}>
              Добавить полис
            </Btn>
          ) : undefined
        }
      />

      <FormError className="page-alert">{err}</FormError>

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

      <Card>
        <CardHeader title="Задачи" />
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableTh>Статус</DataTableTh>
              <DataTableTh>Клиент</DataTableTh>
              <DataTableTh>Телефон</DataTableTh>
              <DataTableTh>Полис</DataTableTh>
              <DataTableTh>Объект страхования</DataTableTh>
              <DataTableTh fit>До окончания</DataTableTh>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {tasks.length === 0 ? (
              <DataTableEmpty colSpan={6}>Нет активных задач.</DataTableEmpty>
            ) : (
              tasks.map((t) => (
                <DataTableClickRow
                  key={t.taskId}
                  onActivate={() => setSelectedTask(t)}
                  ariaLabel="Открыть задачу"
                >
                  <DataTableTd>
                    <TaskStatusBadge status={t.status} />
                  </DataTableTd>
                  <DataTableTd>
                    {t.client.lastName} {t.client.firstName} {t.client.middleName ?? ''}
                  </DataTableTd>
                  <DataTableTd>{t.client.phone}</DataTableTd>
                  <DataTableTd>
                    {t.policy.companyName} / {t.policy.productName}
                  </DataTableTd>
                  <DataTableTd>{t.policy.insuredObject?.trim() || '—'}</DataTableTd>
                  <DataTableTd fit title={formatRenewalTaskDisplay(t.display)}>
                    <span className={renewalTaskDeadlineClass(t.display)}>
                      {formatRenewalTaskDisplay(t.display)}
                    </span>
                  </DataTableTd>
                </DataTableClickRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </Card>
    </div>
  );
}
