import { useEffect, useState } from 'react';
import { ApiError, api } from '../api';
import { ListPaginationFooter } from '../components/ListPaginationFooter';
import { Modal } from '../components/Modal';
import { PageHeading } from '../components/PageHeading';
import { PolicyForm } from '../components/PolicyForm';
import { useDebouncedSearchQuery } from '../hooks/useDebouncedSearchQuery';
import { setDocumentTitle } from '../utils/documentTitle';
import { formatIsoDateRu, formatMoneyRu } from '../utils/formatters';
import { buildListQueryString, type ListPageSize, type Paginated } from '../utils/listPagination';

type Policy = {
  id: string;
  number: string;
  endDate: string;
  insuranceSumS?: string | number | null;
  client: { lastName: string; firstName: string };
  company: { name: string };
};

export function PoliciesPage() {
  const [rows, setRows] = useState<Policy[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listLimit, setListLimit] = useState<ListPageSize>(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [editPolicyId, setEditPolicyId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const { searchInput, setSearchInput, debouncedQ } = useDebouncedSearchQuery(setListPage);

  useEffect(() => {
    setDocumentTitle('Полисы');
  }, []);

  useEffect(() => {
    const q = buildListQueryString(listPage, listLimit, debouncedQ);
    void api<Paginated<Policy>>(`/policies?${q}`)
      .then((res) => {
        setRows(res.items);
        setListTotal(res.total);
        setListError(null);
        const totalPages = Math.max(1, Math.ceil(res.total / res.limit));
        if (res.page > totalPages) {
          setListPage(totalPages);
        }
      })
      .catch((ex) => {
        setRows([]);
        setListTotal(0);
        setListError(ex instanceof ApiError ? ex.message : 'Не удалось загрузить список полисов');
      });
  }, [listPage, listLimit, debouncedQ]);

  async function load() {
    const q = buildListQueryString(listPage, listLimit, debouncedQ);
    try {
      const res = await api<Paginated<Policy>>(`/policies?${q}`);
      setRows(res.items);
      setListTotal(res.total);
      setListError(null);
    } catch (ex) {
      setRows([]);
      setListTotal(0);
      setListError(ex instanceof ApiError ? ex.message : 'Не удалось загрузить список полисов');
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <PageHeading title="Полисы" hint="Реестр оформленных договоров: клиент, дата окончания, стоимость." />
        <div className="page-actions">
          <button type="button" className="btn btn--primary" onClick={() => setCreateOpen(true)}>
            Новый полис
          </button>
        </div>
      </header>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Новый полис"
        size="lg"
      >
        <PolicyForm
          onSuccess={() => {
            setCreateOpen(false);
            void load();
          }}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      <Modal
        open={editPolicyId !== null}
        onClose={() => setEditPolicyId(null)}
        title="Редактирование полиса"
        size="lg"
      >
        {editPolicyId ? (
          <PolicyForm
            key={editPolicyId}
            policyId={editPolicyId}
            onSuccess={() => {
              setEditPolicyId(null);
              void load();
            }}
            onCancel={() => setEditPolicyId(null)}
          />
        ) : null}
      </Modal>

      <section className="card">
        {listError ? (
          <p className="form-error" role="alert">
            {listError}
          </p>
        ) : null}
        <div className="list-search-row">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Номер полиса или ФИО клиента…"
            aria-label="Поиск полисов по номеру или ФИО"
          />
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Клиент</th>
                <th>Компания</th>
                <th>Дата окончания полиса</th>
                <th>Стоимость полиса</th>
                <th className="col--narrow" aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {listTotal === 0 ? (
                <tr className="data-table__empty-row">
                  <td colSpan={6}>
                    <p className="empty-hint empty-hint--in-cell">
                      {debouncedQ ? 'Ничего не найдено — измените запрос.' : 'Полисов пока нет.'}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr
                    key={p.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setEditPolicyId(p.id)}
                  >
                    <td>{p.number}</td>
                    <td>
                      {p.client.lastName} {p.client.firstName}
                    </td>
                    <td>{p.company.name}</td>
                    <td>{formatIsoDateRu(p.endDate)}</td>
                    <td>
                      {p.insuranceSumS !== null && p.insuranceSumS !== undefined && p.insuranceSumS !== ''
                        ? formatMoneyRu(p.insuranceSumS)
                        : '—'}
                    </td>
                    <td className="col--narrow" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => setEditPolicyId(p.id)}
                      >
                        Изменить
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <ListPaginationFooter
          total={listTotal}
          page={listPage}
          limit={listLimit}
          onPageChange={setListPage}
          onLimitChange={(l) => {
            setListLimit(l);
            setListPage(1);
          }}
          navAriaLabel="Страницы списка полисов"
        />
      </section>
    </div>
  );
}
