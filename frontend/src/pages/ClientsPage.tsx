import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { ClientListItem, Paginated } from '../api.types';
import { useAuth } from '../auth';
import { hasPermission } from '../domain/permissions';
import { ClientDetailsModal, type ClientDetails } from '../components/ClientDetailsModal';
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
import { FormActions } from '../components/FormActions';
import { ListPaginationFooter } from '../components/ListPaginationFooter';
import { ListSearchInput, ListToolbar } from '../components/ListToolbar';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { PolicyDetailsModal } from '../components/PolicyDetailsModal';
import { PolicyForm } from '../components/PolicyForm';
import { useDebouncedSearchQuery } from '../hooks/useDebouncedSearchQuery';
import { setDocumentTitle } from '../utils/documentTitle';
import { FieldLabel } from '../components/FieldLabel';
import { ValidatedInput } from '../components/ValidatedInput';
import {
  DEFAULT_LIST_PAGE_SIZE,
  buildListQueryString,
  type ListPageSize,
} from '../utils/listPagination';

function ClientPhoneFields({
  phone,
  setPhone,
  extraPhones,
  setExtraPhones,
}: {
  phone: string;
  setPhone: (value: string) => void;
  extraPhones: string[];
  setExtraPhones: (value: string[] | ((prev: string[]) => string[])) => void;
}) {
  return (
    <div className="field field--span-all">
      <FieldLabel hint="Основной номер клиента">Телефон</FieldLabel>
      <div className="phone-field__rows">
        <div className="phone-field__row">
          <ValidatedInput
            kind="phone"
            value={phone}
            onChange={setPhone}
            required
            autoComplete="tel"
            placeholder="+7 …"
          />
          <Btn
            variant="ghost"
            size="icon"
            className="phone-field__row-btn"
            title="Добавить ещё номер"
            aria-label="Добавить ещё номер"
            onClick={() => setExtraPhones((prev) => [...prev, ''])}
          >
            +
          </Btn>
        </div>
        {extraPhones.map((val, i) => (
          <div key={i} className="phone-field__row">
            <ValidatedInput
              kind="phone"
              value={val}
              onChange={(nextVal) => {
                const next = [...extraPhones];
                next[i] = nextVal;
                setExtraPhones(next);
              }}
              autoComplete="tel"
              placeholder="Доп. номер"
            />
            <Btn
              variant="ghost"
              size="icon"
              className="phone-field__row-btn"
              title="Убрать номер"
              aria-label="Убрать номер"
              onClick={() => setExtraPhones((prev) => prev.filter((_, j) => j !== i))}
            >
              ×
            </Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Разрешены только http/https для безопасного открытия в новой вкладке. */
function safeHttpHref(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  for (const candidate of [t, `https://${t}`]) {
    try {
      const u = new URL(candidate);
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function ClientsPage() {
  const { me } = useAuth();
  const [rows, setRows] = useState<ClientListItem[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listLimit, setListLimit] = useState<ListPageSize>(DEFAULT_LIST_PAGE_SIZE);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [phone, setPhone] = useState('');
  const [extraPhones, setExtraPhones] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [documentsUrl, setDocumentsUrl] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientDetails | null>(null);
  const [policyDetailsId, setPolicyDetailsId] = useState<string | null>(null);
  const [editPolicyId, setEditPolicyId] = useState<string | null>(null);
  const [policyReloadNonce, setPolicyReloadNonce] = useState(0);
  const { searchInput, setSearchInput, debouncedQ } = useDebouncedSearchQuery(setListPage);
  const canManagePolicies = hasPermission(me, 'clients.view_policies');
  const canEditClients = hasPermission(me, 'clients.write');
  const canEditPolicies = hasPermission(me, 'policies.edit');

  useEffect(() => {
    setDocumentTitle('Клиенты');
  }, []);

  useEffect(() => {
    const q = buildListQueryString(listPage, listLimit, debouncedQ);
    void api<Paginated<ClientListItem>>(`/clients?${q}`).then((res) => {
      setRows(res.items);
      setListTotal(res.total);
      const totalPages = Math.max(1, Math.ceil(res.total / res.limit));
      if (res.page > totalPages) {
        setListPage(totalPages);
      }
    });
  }, [listPage, listLimit, debouncedQ]);

  async function load() {
    const q = buildListQueryString(listPage, listLimit, debouncedQ);
    const res = await api<Paginated<ClientListItem>>(`/clients?${q}`);
    setRows(res.items);
    setListTotal(res.total);
  }

  function resetForm() {
    setLastName('');
    setFirstName('');
    setMiddleName('');
    setPhone('');
    setExtraPhones([]);
    setEmail('');
    setDocumentsUrl('');
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setModalOpen(true);
  }

  function openEdit(c: ClientListItem) {
    setEditingId(c.id);
    setLastName(c.lastName);
    setFirstName(c.firstName);
    setMiddleName(c.middleName ?? '');
    setPhone(c.phone);
    setExtraPhones((c.additionalPhones ?? []).map((x) => x.phone));
    setEmail(c.email ?? '');
    setDocumentsUrl(c.documentsUrl ?? '');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  function openClientDetails(c: ClientListItem) {
    setSelectedClient(c);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const additionalPhones = extraPhones.map((s) => s.trim()).filter(Boolean);
    const docTrim = documentsUrl.trim();
    const body: Record<string, unknown> = {
      lastName,
      firstName,
      phone,
      middleName: middleName.trim() || undefined,
      email: email.trim() || undefined,
      additionalPhones,
    };
    /* При редактировании пустая строка → null в JSON, иначе ключ не уйдёт (undefined) и ссылка в БД не очистится. */
    if (editingId) {
      body.documentsUrl = docTrim === '' ? null : docTrim;
      await api(`/clients/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    } else {
      if (docTrim) body.documentsUrl = docTrim;
      await api('/clients', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }
    closeModal();
    void load();
  }

  return (
    <div className="page">
      <PageHeader
        title="Клиенты"
        hint="Справочник клиентов"
        actions={
          canEditClients ? (
            <Btn variant="primary" onClick={openCreate}>
              Новый клиент
            </Btn>
          ) : undefined
        }
      />

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Редактирование клиента' : 'Новый клиент'}
        description={
          editingId
            ? 'Измените данные клиента. Телефон проверяется на корректность, как при создании.'
            : 'Укажите ФИО и телефон. Остальные поля по желанию.'
        }
        size="md"
      >
        <form className="form-grid" onSubmit={(ev) => void onSubmit(ev)}>
          <label className="field">
            <FieldLabel hint="Например: Иванов">Фамилия</FieldLabel>
            <ValidatedInput kind="personName" value={lastName} onChange={setLastName} required />
          </label>
          <label className="field">
            <FieldLabel hint="Например: Иван">Имя</FieldLabel>
            <ValidatedInput kind="personName" value={firstName} onChange={setFirstName} required />
          </label>
          <label className="field field--span-all">
            <FieldLabel hint="Необязательно">Отчество</FieldLabel>
            <ValidatedInput kind="personName" value={middleName} onChange={setMiddleName} />
          </label>
          <ClientPhoneFields
            phone={phone}
            setPhone={setPhone}
            extraPhones={extraPhones}
            setExtraPhones={setExtraPhones}
          />
          <label className="field field--span-all">
            <FieldLabel hint="Необязательно">Email</FieldLabel>
            <ValidatedInput kind="email" type="email" value={email} onChange={setEmail} />
          </label>
          <label className="field field--span-all">
            <FieldLabel hint="Ссылка на файлы клиента">Ссылка на документы</FieldLabel>
            <ValidatedInput kind="url" value={documentsUrl} onChange={setDocumentsUrl} />
          </label>
          <FormActions>
            <Btn variant="primary" type="submit">
              {editingId ? 'Сохранить' : 'Создать'}
            </Btn>
            <Btn variant="ghost" onClick={closeModal}>
              Отмена
            </Btn>
          </FormActions>
        </form>
      </Modal>

      <ClientDetailsModal
        key={selectedClient?.id ?? 'no-client'}
        open={selectedClient !== null}
        client={selectedClient}
        canViewPolicies={canManagePolicies}
        onClose={() => setSelectedClient(null)}
        onOpenPolicy={(policyId) => setPolicyDetailsId(policyId)}
        reloadNonce={policyReloadNonce}
      />

      <PolicyDetailsModal
        open={policyDetailsId !== null}
        policyId={policyDetailsId}
        canEdit={canEditPolicies}
        onClose={() => setPolicyDetailsId(null)}
        onEdit={(policyId) => {
          setPolicyDetailsId(null);
          setEditPolicyId(policyId);
        }}
        reloadNonce={policyReloadNonce}
      />

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
              setPolicyReloadNonce((prev) => prev + 1);
            }}
            onCancel={() => setEditPolicyId(null)}
          />
        ) : null}
      </Modal>

      <Card>
        <CardHeader title="Список" />
        <ListToolbar>
          <ListSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Поиск по ФИО или телефону…"
            aria-label="Поиск клиентов по ФИО или телефону"
          />
        </ListToolbar>
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableTh>ФИО</DataTableTh>
              <DataTableTh>Телефон</DataTableTh>
              <DataTableTh>Документы</DataTableTh>
              <DataTableTh narrow />
            </tr>
          </DataTableHead>
          <DataTableBody>
            {listTotal === 0 ? (
              <DataTableEmpty colSpan={4}>
                {debouncedQ
                  ? 'Никого не нашли — попробуйте другой запрос.'
                  : 'Пока нет клиентов — создайте первого.'}
              </DataTableEmpty>
            ) : (
              rows.map((c) => {
                const docHref = safeHttpHref(c.documentsUrl);
                return (
                  <DataTableClickRow
                    key={c.id}
                    onActivate={() => openClientDetails(c)}
                    ariaLabel="Открыть карточку клиента"
                  >
                    <DataTableTd>
                      {c.lastName} {c.firstName}
                      {c.middleName ? ` ${c.middleName}` : ''}
                    </DataTableTd>
                    <DataTableTd>{c.phone}</DataTableTd>
                    <DataTableTd onClick={(e) => e.stopPropagation()}>
                      {docHref ? (
                        <a href={docHref} target="_blank" rel="noopener noreferrer" title={docHref}>
                          Документы
                        </a>
                      ) : (
                        <span className="text-meta">—</span>
                      )}
                    </DataTableTd>
                    <DataTableActionCell>
                      {canEditClients ? (
                        <Btn variant="ghost" size="sm" onClick={() => openEdit(c)}>
                          Изменить
                        </Btn>
                      ) : null}
                    </DataTableActionCell>
                  </DataTableClickRow>
                );
              })
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
          navAriaLabel="Страницы списка клиентов"
        />
      </Card>
    </div>
  );
}
