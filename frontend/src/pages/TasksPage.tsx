import { useEffect, useState } from 'react';
import { api } from '../api';
import { ManualRenewalTaskModal } from '../components/ManualRenewalTaskModal';
import { Btn } from '../components/Btn';
import { Card, CardHeader } from '../components/Card';
import {
  DataTable,
  DataTableBody,
  DataTableClickRow,
  DataTableClipCell,
  DataTableEmpty,
  DataTableHead,
  DataTableTd,
  DataTableTh,
} from '../components/DataTable';
import { FormError } from '../components/FormActions';
import { ListSearchInput, ListToolbar } from '../components/ListToolbar';
import { ListPaginationFooter } from '../components/ListPaginationFooter';
import { PageHeader } from '../components/PageHeader';
import { RenewalTaskModal, type RenewalTaskRow } from '../components/RenewalTaskModal';
import { TaskStatusBadge } from '../components/TaskStatusBadge';
import { useAuth } from '../auth';
import { useDebouncedSearchQuery } from '../hooks/useDebouncedSearchQuery';
import { hasPermission } from '../domain/permissions';
import { renewalTaskCommentPreview } from '../domain/renewal-task-comment-preview';
import { formatDateTimeRu } from '../utils/formatters';
import { setDocumentTitle } from '../utils/documentTitle';
import {
  DEFAULT_LIST_PAGE_SIZE,
  buildListQueryString,
  type ListPageSize,
} from '../utils/listPagination';

type RenewalTaskRegistryRow = RenewalTaskRow & {
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

export function TasksPage() {
  const { me } = useAuth();
  const [rows, setRows] = useState<RenewalTaskRegistryRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<RenewalTaskRegistryRow | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<ListPageSize>(DEFAULT_LIST_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const { searchInput, setSearchInput, debouncedQ } = useDebouncedSearchQuery(setPage);

  useEffect(() => {
    setDocumentTitle('Задачи');
  }, []);

  useEffect(() => {
    let cancelled = false;
    const qs = buildListQueryString(page, limit, debouncedQ);
    void api<TasksResponse>(`/home/tasks?${qs}`)
      .then((data) => {
        if (cancelled) return;
        setRows(data.items);
        setTotal(data.total);
        setPage(data.page);
        setLimit(data.limit as ListPageSize);
        setErr(null);
      })
      .catch(() => {
        if (!cancelled) setErr('Не удалось загрузить список задач');
      });
    return () => {
      cancelled = true;
    };
  }, [page, limit, reloadNonce, debouncedQ]);

  const canCreateTask = hasPermission(me, 'tasks.create');

  return (
    <div className="page page--tasks-registry">
      <PageHeader
        title="Задачи"
        hint="Реестр задач продления: дата, статус, клиент и комментарий."
        actions={
          canCreateTask ? (
            <Btn variant="primary" onClick={() => setCreateOpen(true)}>
              Создать задачу
            </Btn>
          ) : undefined
        }
      />

      <FormError className="page-alert">{err}</FormError>

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

      <Card>
        <CardHeader title="Список задач" />
        {!err && (
          <ListToolbar>
            <ListSearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Поиск по ФИО клиента…"
              aria-label="Поиск задач по ФИО клиента"
            />
          </ListToolbar>
        )}
        {!err && (
          <div>
            <DataTable>
              <DataTableHead>
                <tr>
                  <DataTableTh date>Создана</DataTableTh>
                  <DataTableTh>Статус</DataTableTh>
                  <DataTableTh>Клиент</DataTableTh>
                  <DataTableTh>Комментарий</DataTableTh>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {rows.length === 0 ? (
                  <DataTableEmpty colSpan={4}>
                    {debouncedQ ? 'Ничего не найдено — измените запрос.' : 'Задач пока нет.'}
                  </DataTableEmpty>
                ) : (
                  rows.map((t) => {
                    const comment = renewalTaskCommentPreview(t);
                    return (
                      <DataTableClickRow
                        key={t.taskId}
                        onActivate={() => setSelected(t)}
                        ariaLabel="Открыть задачу"
                      >
                        <DataTableTd date>{formatDateTimeRu(t.createdAt)}</DataTableTd>
                        <DataTableTd>
                          <TaskStatusBadge status={t.status} />
                        </DataTableTd>
                        <DataTableTd>
                          {t.client.lastName} {t.client.firstName} {t.client.middleName ?? ''}
                        </DataTableTd>
                        <DataTableClipCell title={comment !== '—' ? comment : undefined}>
                          {comment}
                        </DataTableClipCell>
                      </DataTableClickRow>
                    );
                  })
                )}
              </DataTableBody>
            </DataTable>
            <ListPaginationFooter
              total={total}
              page={page}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(l) => {
                setLimit(l);
                setPage(1);
              }}
              navAriaLabel="Страницы реестра задач"
            />
          </div>
        )}
      </Card>
    </div>
  );
}
