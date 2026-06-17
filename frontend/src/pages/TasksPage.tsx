import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { HorizontalScrollWrap } from '../components/HorizontalScrollWrap';
import { ManualRenewalTaskModal } from '../components/ManualRenewalTaskModal';
import { PaginationControls } from '../components/PaginationControls';
import { PageHeading } from '../components/PageHeading';
import { RenewalTaskModal, type RenewalTaskRow } from '../components/RenewalTaskModal';
import { useAuth } from '../auth';
import { formatRenewalTaskDisplay, renewalTaskDeadlineClass } from '../domain/renewal-task-display';
import { RENEWAL_STATUS_LABELS, renewalStatusBadgeClass } from '../domain/renewal-task-status';
import { formatRenewalPolicyLabel } from '../domain/renewal-task-policy-label';
import { setDocumentTitle } from '../utils/documentTitle';

export type RenewalTaskRegistryRow = RenewalTaskRow & {
  taskNumber: number;
  createdAt: string;
  statusChangedAt: string;
};

type TasksResponse = {
  items: RenewalTaskRegistryRow[];
  total: number;
  page: number;
  limit: number;
};

const TASK_PAGE_LIMITS = [10, 25, 50] as const;

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function TasksPage() {
  const { me } = useAuth();
  const [rows, setRows] = useState<RenewalTaskRegistryRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<RenewalTaskRegistryRow | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof TASK_PAGE_LIMITS)[number]>(25);
  const [total, setTotal] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [clientSearch, setClientSearch] = useState('');
  const [clientSearchApplied, setClientSearchApplied] = useState('');

  useEffect(() => {
    setDocumentTitle('Задачи');
  }, []);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    const q = clientSearchApplied.trim();
    if (q) qs.set('q', q);
    void api<TasksResponse>(`/home/tasks?${qs.toString()}`)
      .then((data) => {
        if (cancelled) return;
        setRows(data.items);
        setTotal(data.total);
        setPage(data.page);
        setLimit(data.limit as (typeof TASK_PAGE_LIMITS)[number]);
        setErr(null);
      })
      .catch(() => {
        if (!cancelled) setErr('Не удалось загрузить список задач');
      });
    return () => {
      cancelled = true;
    };
  }, [page, limit, reloadNonce, clientSearchApplied]);

  function submitClientSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setClientSearchApplied(clientSearch.trim());
  }

  function clearClientSearch() {
    setClientSearch('');
    setClientSearchApplied('');
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canCreateTask =
    me?.role === 'SUPER_ADMIN' || me?.role === 'SUPER_MANAGER' || me?.role === 'MANAGER';

  return (
    <div className="page page--tasks-registry">
      <header className="page-header">
        <PageHeading
          title="Задачи"
          hint="Реестр задач продления: срок, статус, клиент и полис."
        />
        {canCreateTask && (
          <div className="page-actions">
            <button type="button" className="btn btn--primary" onClick={() => setCreateOpen(true)}>
              Создать задачу
            </button>
          </div>
        )}
      </header>

      {err && (
        <p className="form-error page-alert" role="alert">
          {err}
        </p>
      )}

      <ManualRenewalTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setReloadNonce((prev) => prev + 1)}
      />

      <RenewalTaskModal
        task={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
        onUpdated={() => setReloadNonce((prev) => prev + 1)}
      />

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Список задач</h2>
          {!err && (
            <div className="table-controls table-controls--tasks-registry">
              <form className="tasks-registry-search" onSubmit={submitClientSearch}>
                <label className="field field--inline tasks-registry-search__field">
                  <span className="field-label">Поиск по ФИО</span>
                  <input
                    type="search"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Фамилия, имя…"
                    autoComplete="off"
                  />
                </label>
                <button type="submit" className="btn btn--ghost btn--sm">
                  Найти
                </button>
                {clientSearchApplied ? (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={clearClientSearch}>
                    Сбросить
                  </button>
                ) : null}
              </form>
              <label className="field field--inline">
                <span className="field-label">На странице</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    const nextLimit = Number(e.target.value) as (typeof TASK_PAGE_LIMITS)[number];
                    setLimit(nextLimit);
                    setPage(1);
                  }}
                >
                  {TASK_PAGE_LIMITS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
        {!err && (
          <div>
            <HorizontalScrollWrap className="data-table-wrap">
              <table className="data-table data-table--task-registry">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Создана</th>
                    <th>Статус</th>
                    <th>Клиент</th>
                    <th>Текущий полис</th>
                    <th>Новый полис</th>
                    <th>Объект страхования</th>
                    <th>Срок</th>
                    <th>Причина отказа</th>
                    <th>Ожидание от клиента</th>
                    <th>Комментарий (отложена)</th>
                    <th>Статус изменён</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr className="data-table__empty-row">
                      <td colSpan={12}>
                        <p className="empty-hint empty-hint--in-cell">Задач пока нет.</p>
                      </td>
                    </tr>
                  ) : (
                    rows.map((t) => (
                      <tr
                        key={t.taskId}
                        className="data-table__click-row"
                        onClick={() => setSelected(t)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelected(t);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label="Открыть задачу"
                      >
                        <td className="data-table__num">{t.taskNumber}</td>
                        <td>{formatDateTime(t.createdAt)}</td>
                        <td>
                          <span className={renewalStatusBadgeClass(t.status)}>
                            {RENEWAL_STATUS_LABELS[t.status]}
                          </span>
                        </td>
                        <td>
                          {t.client.lastName} {t.client.firstName} {t.client.middleName ?? ''}
                        </td>
                        <td className="data-table__policy-cell">
                          {formatRenewalPolicyLabel(t.policy)}
                        </td>
                        <td className="data-table__policy-cell">
                          {t.status === 'RENEWED' && t.renewedPolicy
                            ? formatRenewalPolicyLabel(t.renewedPolicy)
                            : '—'}
                        </td>
                        <td>{t.policy.insuredObject?.trim() || '—'}</td>
                        <td>
                          <span className={renewalTaskDeadlineClass(t.display)}>
                            {formatRenewalTaskDisplay(t.display)}
                          </span>
                        </td>
                        <td
                          className="data-table__decline-reason"
                          title={t.declineReason?.trim() || undefined}
                        >
                          {t.declineReason?.trim() ? t.declineReason : '—'}
                        </td>
                        <td
                          className="data-table__decline-reason"
                          title={t.feedbackComment?.trim() || undefined}
                        >
                          {t.feedbackComment?.trim() ? t.feedbackComment : '—'}
                        </td>
                        <td
                          className="data-table__decline-reason"
                          title={t.postponeComment?.trim() || undefined}
                        >
                          {t.postponeComment?.trim() ? t.postponeComment : '—'}
                        </td>
                        <td>{formatDateTime(t.statusChangedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </HorizontalScrollWrap>
            <div className="audit-footer audit-footer--nav-only">
              <PaginationControls
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                ariaLabel="Страницы реестра задач"
                center={
                  <span className="pagination-controls__meta">
                    Страница {page} из {totalPages} · всего {total}
                  </span>
                }
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
