import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { ClientListItem, Paginated } from '../api.types';
import { useAuth } from '../auth';
import { ClientDetailsModal, type ClientDetails } from '../components/ClientDetailsModal';
import { ListPaginationFooter } from '../components/ListPaginationFooter';
import { Modal } from '../components/Modal';
import { PageHeading } from '../components/PageHeading';
import { PolicyDetailsModal } from '../components/PolicyDetailsModal';
import { PolicyForm } from '../components/PolicyForm';
import { useDebouncedSearchQuery } from '../hooks/useDebouncedSearchQuery';
import { setDocumentTitle } from '../utils/documentTitle';
import { FieldHint } from '../components/FieldHint';
import { ValidatedInput } from '../components/ValidatedInput';
import { buildListQueryString, type ListPageSize } from '../utils/listPagination';

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
    <div className="field" style={{ gridColumn: '1 / -1' }}>
      <span className="field-label">Телефон</span>
      <div className="phone-field__rows">
        <div className="phone-field__row">
          <ValidatedInput
            kind="phone"
            value={phone}
            onChange={setPhone}
            required
            autoComplete="tel"
            placeholder="+7 …"
            hideHint
          />
          <button
            type="button"
            className="btn btn--ghost phone-field__row-btn"
            title="Добавить ещё номер"
            aria-label="Добавить ещё номер"
            onClick={() => setExtraPhones((prev) => [...prev, ''])}
          >
            +
          </button>
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
              hideHint
            />
            <button
              type="button"
              className="btn btn--ghost phone-field__row-btn"
              title="Убрать номер"
              aria-label="Убрать номер"
              onClick={() => setExtraPhones((prev) => prev.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <FieldHint>Например: +79001234567</FieldHint>
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
  const [listLimit, setListLimit] = useState<ListPageSize>(10);
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
  const canManagePolicies = me?.role === 'SUPER_ADMIN' || me?.role === 'SUPER_MANAGER';

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
      <header className="page-header">
        <PageHeading title="Клиенты" hint="Справочник клиентов" />
        <div className="page-actions">
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            Новый клиент
          </button>
        </div>
      </header>

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
            <span className="field-label">Фамилия</span>
            <ValidatedInput kind="personName" value={lastName} onChange={setLastName} required />
          </label>
          <label className="field">
            <span className="field-label">Имя</span>
            <ValidatedInput kind="personName" value={firstName} onChange={setFirstName} required />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span className="field-label">Отчество</span>
            <ValidatedInput kind="personName" value={middleName} onChange={setMiddleName} />
          </label>
          <ClientPhoneFields
            phone={phone}
            setPhone={setPhone}
            extraPhones={extraPhones}
            setExtraPhones={setExtraPhones}
          />
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span className="field-label">Email</span>
            <ValidatedInput
              kind="email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="опционально"
            />
          </label>
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span className="field-label">Ссылка на документы</span>
            <ValidatedInput
              kind="url"
              value={documentsUrl}
              onChange={setDocumentsUrl}
              placeholder="URL в облаке, опционально"
            />
          </label>
          <div className="form-actions">
            <button className="btn btn--primary" type="submit">
              {editingId ? 'Сохранить' : 'Создать'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={closeModal}>
              Отмена
            </button>
          </div>
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
        canEdit={canManagePolicies}
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

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Список</h2>
        </div>
        <div className="list-search-row">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Поиск по ФИО или телефону…"
            aria-label="Поиск клиентов по ФИО или телефону"
          />
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Телефон</th>
                <th>Документы</th>
                <th className="col--narrow" />
              </tr>
            </thead>
            <tbody>
              {listTotal === 0 ? (
                <tr className="data-table__empty-row">
                  <td colSpan={4}>
                    <p className="empty-hint empty-hint--in-cell">
                      {debouncedQ
                        ? 'Никого не нашли — попробуйте другой запрос.'
                        : 'Пока нет клиентов — создайте первого.'}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((c) => {
                  const docHref = safeHttpHref(c.documentsUrl);
                  return (
                    <tr
                      key={c.id}
                      className="data-table__click-row"
                      onClick={() => openClientDetails(c)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openClientDetails(c);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label="Открыть карточку клиента"
                    >
                      <td>
                        {c.lastName} {c.firstName}
                        {c.middleName ? ` ${c.middleName}` : ''}
                      </td>
                      <td>{c.phone}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {docHref ? (
                          <a href={docHref} target="_blank" rel="noopener noreferrer" title={docHref}>
                            Документы
                          </a>
                        ) : (
                          <span style={{ color: 'var(--fg-muted)', fontWeight: 500 }}>—</span>
                        )}
                      </td>
                      <td className="col--narrow" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => openEdit(c)}>
                          Изменить
                        </button>
                      </td>
                    </tr>
                  );
                })
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
          navAriaLabel="Страницы списка клиентов"
        />
      </section>
    </div>
  );
}
