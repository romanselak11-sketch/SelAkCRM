import { useEffect, useState } from 'react';
import { ApiError, api } from '../api';
import { Btn } from '../components/Btn';
import { Card, CardHeader } from '../components/Card';
import {
  DataTable,
  DataTableActionCell,
  DataTableBody,
  DataTableClickRow,
  DataTableEmpty,
  DataTableHead,
  DataTableTd,
  DataTableTh,
} from '../components/DataTable';
import { FormError } from '../components/FormActions';
import { ListSearchInput, ListToolbar } from '../components/ListToolbar';
import { ListPaginationFooter } from '../components/ListPaginationFooter';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { PolicyForm } from '../components/PolicyForm';
import { useDebouncedSearchQuery } from '../hooks/useDebouncedSearchQuery';
import { setDocumentTitle } from '../utils/documentTitle';
import { formatIsoDateRu, formatMoneyRu } from '../utils/formatters';
import {
  DEFAULT_LIST_PAGE_SIZE,
  buildListQueryString,
  type ListPageSize,
  type Paginated,
} from '../utils/listPagination';

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
  const [listLimit, setListLimit] = useState<ListPageSize>(DEFAULT_LIST_PAGE_SIZE);
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
      <PageHeader
        title="Полисы"
        hint="Реестр оформленных договоров: клиент, дата окончания, стоимость."
        actions={
          <Btn variant="primary" onClick={() => setCreateOpen(true)}>
            Новый полис
          </Btn>
        }
      />

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

      <Card>
        <CardHeader title="Список" />
        <FormError>{listError}</FormError>
        <ListToolbar>
          <ListSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Номер полиса или ФИО клиента…"
            aria-label="Поиск полисов по номеру или ФИО"
          />
        </ListToolbar>
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableTh>Номер</DataTableTh>
              <DataTableTh>Клиент</DataTableTh>
              <DataTableTh>Компания</DataTableTh>
              <DataTableTh date>Дата окончания полиса</DataTableTh>
              <DataTableTh numeric>Стоимость полиса</DataTableTh>
              <DataTableTh narrow aria-label="Действия" />
            </tr>
          </DataTableHead>
          <DataTableBody>
            {listTotal === 0 ? (
              <DataTableEmpty colSpan={6}>
                {debouncedQ ? 'Ничего не найдено — измените запрос.' : 'Полисов пока нет.'}
              </DataTableEmpty>
            ) : (
              rows.map((p) => (
                <DataTableClickRow
                  key={p.id}
                  onActivate={() => setEditPolicyId(p.id)}
                  ariaLabel={`Открыть полис ${p.number}`}
                >
                  <DataTableTd>{p.number}</DataTableTd>
                  <DataTableTd>
                    {p.client.lastName} {p.client.firstName}
                  </DataTableTd>
                  <DataTableTd>{p.company.name}</DataTableTd>
                  <DataTableTd date>{formatIsoDateRu(p.endDate)}</DataTableTd>
                  <DataTableTd numeric>
                    {p.insuranceSumS !== null && p.insuranceSumS !== undefined && p.insuranceSumS !== ''
                      ? formatMoneyRu(p.insuranceSumS)
                      : '—'}
                  </DataTableTd>
                  <DataTableActionCell>
                    <Btn variant="ghost" size="sm" onClick={() => setEditPolicyId(p.id)}>
                      Изменить
                    </Btn>
                  </DataTableActionCell>
                </DataTableClickRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
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
      </Card>
    </div>
  );
}
