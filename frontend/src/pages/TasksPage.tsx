import { useEffect, useState } from 'react';
import { api } from '../api';
import { PageHeading } from '../components/PageHeading';
import { RenewalTaskModal, type RenewalTaskRow } from '../components/RenewalTaskModal';
import { RENEWAL_STATUS_LABELS, renewalStatusBadgeClass } from '../domain/renewal-task-status';
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
  const [rows, setRows] = useState<RenewalTaskRegistryRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<RenewalTaskRegistryRow | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof TASK_PAGE_LIMITS)[number]>(25);
  const [total, setTotal] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    setDocumentTitle('Задачи');
  }, []);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
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
  }, [page, limit, reloadNonce]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="page">
      <header className="page-header">
        <PageHeading
          title="Задачи"
          hint="Реестр задач продления: номер, даты создания и смены статуса."
        />
      </header>

      {err && (
        <p className="form-error page-alert" role="alert">
          {err}
        </p>
      )}

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
            <div className="table-controls">
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
            <div className="data-table-wrap">
              <table className="data-table data-table--task-registry">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Создана</th>
                    <th>Статус</th>
                    <th>Причина отказа</th>
                    <th>Статус изменён</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr className="data-table__empty-row">
                      <td colSpan={5}>
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
                        <td
                          className="data-table__decline-reason"
                          title={t.declineReason?.trim() || undefined}
                        >
                          {t.declineReason?.trim() ? t.declineReason : '—'}
                        </td>
                        <td>{formatDateTime(t.statusChangedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-pagination">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
              >
                Назад
              </button>
              <span className="empty-hint">
                Страница {page} из {totalPages} · всего {total}
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
              >
                Вперёд
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
