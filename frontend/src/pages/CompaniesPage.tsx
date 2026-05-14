import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, api } from '../api';
import { useAuth } from '../auth';
import { ListPaginationFooter } from '../components/ListPaginationFooter';
import { ConfirmModal } from '../components/ConfirmModal';
import { Modal } from '../components/Modal';
import { PageHeading } from '../components/PageHeading';
import { useDebouncedSearchQuery } from '../hooks/useDebouncedSearchQuery';
import { setDocumentTitle } from '../utils/documentTitle';
import { buildListQueryString, type ListPageSize, type Paginated } from '../utils/listPagination';

type Company = {
  id: string;
  name: string;
};

type ProductRow = {
  id: string;
  name: string;
  defaultPremiumPct?: string | number | null;
};

function formatProductPct(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

export function CompaniesPage() {
  const { me } = useAuth();
  const canEditInsurance = me?.role === 'SUPER_ADMIN' || me?.role === 'SUPER_MANAGER';
  const [rows, setRows] = useState<Company[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listLimit, setListLimit] = useState<ListPageSize>(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyProducts, setCompanyProducts] = useState<ProductRow[]>([]);
  const [productName, setProductName] = useState('');
  const [productPremiumPct, setProductPremiumPct] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [companyEditName, setCompanyEditName] = useState('');
  const [companySaving, setCompanySaving] = useState(false);
  const [archiveCompanyId, setArchiveCompanyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const { searchInput, setSearchInput, debouncedQ } = useDebouncedSearchQuery(setListPage);

  useEffect(() => {
    setDocumentTitle('Компании');
  }, []);

  useEffect(() => {
    setCompanyEditName(selectedCompany?.name ?? '');
  }, [selectedCompany]);

  useEffect(() => {
    const q = buildListQueryString(listPage, listLimit, debouncedQ);
    void api<Paginated<Company>>(`/insurance-companies?${q}`)
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
        setListError(ex instanceof ApiError ? ex.message : 'Не удалось загрузить компании');
      });
  }, [listPage, listLimit, debouncedQ]);

  async function load() {
    const q = buildListQueryString(listPage, listLimit, debouncedQ);
    try {
      const res = await api<Paginated<Company>>(`/insurance-companies?${q}`);
      setRows(res.items);
      setListTotal(res.total);
      setListError(null);
    } catch (ex) {
      setRows([]);
      setListTotal(0);
      setListError(ex instanceof ApiError ? ex.message : 'Не удалось загрузить компании');
    }
  }

  useEffect(() => {
    if (!selectedCompany) {
      setCompanyProducts([]);
      return;
    }
    void api<ProductRow[]>(`/insurance-companies/${selectedCompany.id}/products`).then(
      setCompanyProducts,
      (ex) => {
        setCompanyProducts([]);
        setFormError(ex instanceof ApiError ? ex.message : 'Не удалось загрузить продукты компании');
      },
    );
  }, [selectedCompany]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canEditInsurance) {
      setFormError('Недостаточно прав для изменения справочника компаний');
      return;
    }
    try {
      setFormError(null);
      await api('/insurance-companies', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setName('');
      setModalOpen(false);
      void load();
    } catch (ex) {
      setFormError(ex instanceof ApiError ? ex.message : 'Не удалось создать компанию');
    }
  }

  async function confirmArchiveCompany() {
    if (!archiveCompanyId) return;
    if (!canEditInsurance) {
      setFormError('Недостаточно прав для изменения справочника компаний');
      return;
    }
    try {
      setFormError(null);
      await api(`/insurance-companies/${archiveCompanyId}/archive`, { method: 'POST' });
      setArchiveCompanyId(null);
      void load();
    } catch (ex) {
      setFormError(ex instanceof ApiError ? ex.message : 'Не удалось отправить компанию в архив');
    }
  }

  function resetProductForm() {
    setProductName('');
    setProductPremiumPct('');
    setEditingProductId(null);
  }

  async function refreshCompanyProducts() {
    if (!selectedCompany) return;
    const list = await api<ProductRow[]>(
      `/insurance-companies/${selectedCompany.id}/products`,
    );
    setCompanyProducts(list);
    void load();
  }

  function startEditProduct(p: ProductRow) {
    setEditingProductId(p.id);
    setProductName(p.name);
    setProductPremiumPct(formatProductPct(p.defaultPremiumPct) ?? '');
  }

  async function onProductFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedCompany) return;
    if (!canEditInsurance) {
      setFormError('Недостаточно прав для изменения продуктов');
      return;
    }
    const pctStr = productPremiumPct.trim();
    const pctParsed = pctStr === '' ? null : Number(pctStr.replace(',', '.'));
    if (pctStr !== '' && Number.isNaN(pctParsed)) return;
    const pctPayload = pctStr === '' ? null : String(pctParsed);

    try {
      setFormError(null);
      if (editingProductId) {
        await api(`/insurance-products/${editingProductId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: productName,
            defaultPremiumPct: pctPayload,
          }),
        });
      } else {
        await api(`/insurance-companies/${selectedCompany.id}/products`, {
          method: 'POST',
          body: JSON.stringify({
            name: productName,
            ...(pctPayload !== null && { defaultPremiumPct: pctPayload }),
          }),
        });
      }
      resetProductForm();
      void refreshCompanyProducts();
    } catch (ex) {
      setFormError(ex instanceof ApiError ? ex.message : 'Не удалось сохранить продукт');
    }
  }

  function closeProductsModal() {
    setSelectedCompany(null);
    resetProductForm();
    setCompanyEditName('');
    setFormError(null);
  }

  async function onSaveCompanyName(e: FormEvent) {
    e.preventDefault();
    if (!selectedCompany) return;
    if (!canEditInsurance) {
      setFormError('Недостаточно прав для изменения справочника компаний');
      return;
    }
    const next = companyEditName.trim();
    if (!next || next === selectedCompany.name.trim()) return;
    setCompanySaving(true);
    try {
      setFormError(null);
      const updated = await api<{ id: string; name: string }>(`/insurance-companies/${selectedCompany.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: next }),
      });
      setSelectedCompany((prev) =>
        prev && prev.id === selectedCompany.id ? { ...prev, name: updated.name } : prev,
      );
      void load();
    } catch (ex) {
      setFormError(ex instanceof ApiError ? ex.message : 'Не удалось обновить название компании');
    } finally {
      setCompanySaving(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <PageHeading title="Страховые компании" hint="Справочник партнёров и продуктов" />
        <div className="page-actions">
          {canEditInsurance ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setName('');
                setFormError(null);
                setModalOpen(true);
              }}
            >
              Новая компания
            </button>
          ) : null}
        </div>
      </header>

      <ConfirmModal
        open={archiveCompanyId !== null}
        onClose={() => setArchiveCompanyId(null)}
        title="В архив"
        description="Переместить компанию в архив? Она скроется из каталога."
        confirmLabel="В архив"
        confirmVariant="danger-soft"
        onConfirm={confirmArchiveCompany}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Новая компания"
        description="Добавьте страховую компанию в справочник. Продукты можно настроить позже."
        size="sm"
      >
        <form onSubmit={onCreate} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <label className="field">
            <span className="field-label">Название</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, АО «Ромашка»"
              required
            />
          </label>
          <div className="form-actions">
            <button className="btn btn--primary" type="submit">
              Добавить
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setModalOpen(false)}>
              Отмена
            </button>
          </div>
        </form>
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={selectedCompany !== null}
        onClose={closeProductsModal}
        title={selectedCompany?.name ?? 'Компания'}
        description="Название компании, продукты и P% по умолчанию для оформления полисов."
        size="md"
      >
        <form
          onSubmit={(ev) => void onSaveCompanyName(ev)}
          className="form-grid form-grid--one"
          style={{ marginBottom: 'var(--space-5)' }}
        >
          <label className="field">
            <span className="field-label">Название компании</span>
            <input
              value={companyEditName}
              onChange={(e) => setCompanyEditName(e.target.value)}
              placeholder="Например, АО «Ромашка»"
              minLength={1}
              required
            />
          </label>
          {canEditInsurance ? (
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={
                  companySaving ||
                  !companyEditName.trim() ||
                  companyEditName.trim() === selectedCompany?.name.trim()
                }
              >
                {companySaving ? 'Сохранение…' : 'Сохранить название'}
              </button>
            </div>
          ) : null}
        </form>

        {companyProducts.length === 0 ? (
          <p className="empty-hint empty-hint--panel" style={{ marginBottom: 'var(--space-5)' }}>
            Продуктов пока нет.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 var(--space-5)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            {companyProducts.map((p) => (
              <li
                key={p.id}
                style={{
                  padding: 'var(--space-3) var(--space-3)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.9375rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  background:
                    editingProductId === p.id ? 'var(--surface-2)' : undefined,
                }}
              >
                <div>
                  <span>{p.name}</span>
                  {formatProductPct(p.defaultPremiumPct) != null ? (
                    <span style={{ color: 'var(--fg-muted)', marginLeft: '0.5rem' }}>
                      P% {formatProductPct(p.defaultPremiumPct)}
                    </span>
                  ) : null}
                </div>
                {canEditInsurance ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => startEditProduct(p)}
                  >
                    Изменить
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canEditInsurance ? (
          <form
            onSubmit={(ev) => void onProductFormSubmit(ev)}
            className="form-grid"
            style={{ gridTemplateColumns: '1fr' }}
          >
            <label className="field">
              <span className="field-label">{editingProductId ? 'Название' : 'Новый продукт'}</span>
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Например, ОСАГО"
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Комиссия агента в %</span>
              <input
                value={productPremiumPct}
                onChange={(e) => setProductPremiumPct(e.target.value)}
                placeholder="Например, 12.5"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
              />
            </label>
            <div className="form-actions">
              <button className="btn btn--primary" type="submit">
                {editingProductId ? 'Сохранить' : 'Добавить продукт'}
              </button>
              {editingProductId ? (
                <button type="button" className="btn btn--ghost" onClick={resetProductForm}>
                  Отменить редактирование
                </button>
              ) : null}
              <button type="button" className="btn btn--ghost" onClick={closeProductsModal}>
                Закрыть
              </button>
            </div>
          </form>
        ) : (
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={closeProductsModal}>
              Закрыть
            </button>
          </div>
        )}
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
      </Modal>

      <section className="card">
        {listError ? (
          <p className="form-error" role="alert">
            {listError}
          </p>
        ) : null}
        <div className="card-header">
          <h2 className="card-title">Каталог</h2>
        </div>
        <div className="list-search-row">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Поиск по названию компании…"
            aria-label="Поиск компаний по названию"
          />
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Название</th>
                <th className="col--narrow" aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {listTotal === 0 ? (
                <tr className="data-table__empty-row">
                  <td colSpan={2}>
                    <p className="empty-hint empty-hint--in-cell">
                      {debouncedQ
                        ? 'Ничего не найдено — измените запрос.'
                        : 'Компаний пока нет — добавьте первую через «Новая компания».'}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr
                    key={c.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedCompany(c)}
                  >
                    <td>{c.name}</td>
                    <td className="col--narrow" onClick={(e) => e.stopPropagation()}>
                      {canEditInsurance ? (
                        <button
                          type="button"
                          className="btn btn--danger-soft btn--sm"
                          onClick={() => setArchiveCompanyId(c.id)}
                        >
                          В архив
                        </button>
                      ) : null}
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
          navAriaLabel="Страницы каталога компаний"
        />
      </section>
    </div>
  );
}
