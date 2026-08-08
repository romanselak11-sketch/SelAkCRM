import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError, api } from '../api';
import { useAuth } from '../auth';
import { hasPermission } from '../domain/permissions';
import { ListPaginationFooter } from '../components/ListPaginationFooter';
import { ConfirmModal } from '../components/ConfirmModal';
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
import { EmptyHint } from '../components/EmptyHint';
import { EntityList, EntityListItem, EntityListMeta } from '../components/EntityList';
import { FormActions, FormError } from '../components/FormActions';
import { ListSearchInput, ListToolbar } from '../components/ListToolbar';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { useDebouncedSearchQuery } from '../hooks/useDebouncedSearchQuery';
import { setDocumentTitle } from '../utils/documentTitle';
import { FieldLabel } from '../components/FieldLabel';
import { ValidatedInput } from '../components/ValidatedInput';
import {
  DEFAULT_LIST_PAGE_SIZE,
  buildListQueryString,
  type ListPageSize,
  type Paginated,
} from '../utils/listPagination';
import { formatMoneyForField, normalizeMoneyForApi } from '../utils/moneyInput';

type Company = {
  id: string;
  name: string;
};

type ProductRow = {
  id: string;
  name: string;
  defaultPremiumPct?: string | number | null;
  defaultPremiumRubles?: string | number | null;
};

function formatProductPct(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

function formatProductRubles(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined || v === '') return null;
  const formatted = formatMoneyForField(v);
  return formatted || null;
}

export function CompaniesPage() {
  const { me } = useAuth();
  const canEditInsurance = hasPermission(me, 'insurance.write');
  const [rows, setRows] = useState<Company[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listLimit, setListLimit] = useState<ListPageSize>(DEFAULT_LIST_PAGE_SIZE);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyProducts, setCompanyProducts] = useState<ProductRow[]>([]);
  const [productName, setProductName] = useState('');
  const [productPremiumPct, setProductPremiumPct] = useState('');
  const [productPremiumRubles, setProductPremiumRubles] = useState('');
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
    setProductPremiumRubles('');
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
    setProductPremiumRubles(formatProductRubles(p.defaultPremiumRubles) ?? '');
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

    const rubStr = productPremiumRubles.trim();
    const rubNormalized = rubStr === '' ? null : normalizeMoneyForApi(rubStr);
    if (rubStr !== '' && !rubNormalized) return;
    const rubPayload = rubNormalized;

    try {
      setFormError(null);
      if (editingProductId) {
        await api(`/insurance-products/${editingProductId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: productName,
            defaultPremiumPct: pctPayload,
            defaultPremiumRubles: rubPayload,
          }),
        });
      } else {
        await api(`/insurance-companies/${selectedCompany.id}/products`, {
          method: 'POST',
          body: JSON.stringify({
            name: productName,
            ...(pctPayload !== null && { defaultPremiumPct: pctPayload }),
            ...(rubPayload !== null && { defaultPremiumRubles: rubPayload }),
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
      <PageHeader
        title="Страховые компании"
        hint="Справочник партнёров и продуктов"
        actions={
          canEditInsurance ? (
            <Btn
              variant="primary"
              onClick={() => {
                setName('');
                setFormError(null);
                setModalOpen(true);
              }}
            >
              Новая компания
            </Btn>
          ) : null
        }
      />

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
        <form onSubmit={onCreate} className="form-grid form-grid--one">
          <label className="field">
            <FieldLabel hint="Как в договорах">Название</FieldLabel>
            <ValidatedInput kind="text" value={name} onChange={setName} required />
          </label>
          <FormActions>
            <Btn variant="primary" type="submit">
              Добавить
            </Btn>
            <Btn variant="ghost" onClick={() => setModalOpen(false)}>
              Отмена
            </Btn>
          </FormActions>
        </form>
        <FormError>{formError}</FormError>
      </Modal>

      <Modal
        open={selectedCompany !== null}
        onClose={closeProductsModal}
        title={selectedCompany?.name ?? 'Компания'}
        description="Название компании, продукты и комиссия (P% / P₽) по умолчанию для оформления полисов."
        size="md"
      >
        <form
          onSubmit={(ev) => void onSaveCompanyName(ev)}
          className="form-grid form-grid--one u-mb-5"
        >
          <label className="field">
            <FieldLabel hint="Как в договорах">Название компании</FieldLabel>
            <ValidatedInput
              kind="text"
              value={companyEditName}
              onChange={setCompanyEditName}
              minLength={1}
              required
            />
          </label>
          {canEditInsurance ? (
            <FormActions>
              <Btn
                type="submit"
                variant="primary"
                disabled={
                  companySaving ||
                  !companyEditName.trim() ||
                  companyEditName.trim() === selectedCompany?.name.trim()
                }
              >
                {companySaving ? 'Сохранение…' : 'Сохранить название'}
              </Btn>
            </FormActions>
          ) : null}
        </form>

        {companyProducts.length === 0 ? (
          <EmptyHint variant="panel" className="u-mb-5">
            Продуктов пока нет.
          </EmptyHint>
        ) : (
          <EntityList spaced>
            {companyProducts.map((p) => (
              <EntityListItem key={p.id} active={editingProductId === p.id}>
                <div>
                  <span>{p.name}</span>
                  {formatProductPct(p.defaultPremiumPct) != null ? (
                    <EntityListMeta>P% {formatProductPct(p.defaultPremiumPct)}</EntityListMeta>
                  ) : null}
                  {formatProductRubles(p.defaultPremiumRubles) != null ? (
                    <EntityListMeta>P₽ {formatProductRubles(p.defaultPremiumRubles)}</EntityListMeta>
                  ) : null}
                </div>
                {canEditInsurance ? (
                  <Btn variant="ghost" size="sm" onClick={() => startEditProduct(p)}>
                    Изменить
                  </Btn>
                ) : null}
              </EntityListItem>
            ))}
          </EntityList>
        )}
        {canEditInsurance ? (
          <form
            onSubmit={(ev) => void onProductFormSubmit(ev)}
            className="form-grid form-grid--one"
          >
            <label className="field">
              <FieldLabel hint="Например: ОСАГО">
                {editingProductId ? 'Название' : 'Новый продукт'}
              </FieldLabel>
              <ValidatedInput kind="text" value={productName} onChange={setProductName} required />
            </label>
            <label className="field">
              <FieldLabel hint="Процент по умолчанию">Комиссия агента в %</FieldLabel>
              <ValidatedInput
                kind="decimal"
                value={productPremiumPct}
                onChange={setProductPremiumPct}
              />
            </label>
            <label className="field">
              <FieldLabel hint="Сумма по умолчанию, ₽">Комиссия агента в ₽</FieldLabel>
              <ValidatedInput
                kind="money"
                value={productPremiumRubles}
                onChange={setProductPremiumRubles}
                onBlur={() => setProductPremiumRubles((v) => formatMoneyForField(v))}
              />
            </label>
            <FormActions>
              <Btn variant="primary" type="submit">
                {editingProductId ? 'Сохранить' : 'Добавить продукт'}
              </Btn>
              {editingProductId ? (
                <Btn variant="ghost" onClick={resetProductForm}>
                  Отменить редактирование
                </Btn>
              ) : null}
              <Btn variant="ghost" onClick={closeProductsModal}>
                Закрыть
              </Btn>
            </FormActions>
          </form>
        ) : (
          <FormActions>
            <Btn variant="ghost" onClick={closeProductsModal}>
              Закрыть
            </Btn>
          </FormActions>
        )}
        <FormError>{formError}</FormError>
      </Modal>

      <Card>
        <FormError>{listError}</FormError>
        <CardHeader title="Каталог" />
        <ListToolbar>
          <ListSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Поиск по названию компании…"
            aria-label="Поиск компаний по названию"
          />
        </ListToolbar>
        <DataTable>
          <DataTableHead>
            <tr>
              <DataTableTh>Название</DataTableTh>
              <DataTableTh narrow aria-label="Действия" />
            </tr>
          </DataTableHead>
          <DataTableBody>
            {listTotal === 0 ? (
              <DataTableEmpty colSpan={2}>
                {debouncedQ
                  ? 'Ничего не найдено — измените запрос.'
                  : 'Компаний пока нет — добавьте первую через «Новая компания».'}
              </DataTableEmpty>
            ) : (
              rows.map((c) => (
                <DataTableClickRow
                  key={c.id}
                  onActivate={() => setSelectedCompany(c)}
                  ariaLabel={`Открыть компанию ${c.name}`}
                >
                  <DataTableTd>{c.name}</DataTableTd>
                  <DataTableActionCell>
                    {canEditInsurance ? (
                      <Btn
                        variant="danger-soft"
                        size="sm"
                        onClick={() => setArchiveCompanyId(c.id)}
                      >
                        В архив
                      </Btn>
                    ) : null}
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
          navAriaLabel="Страницы каталога компаний"
        />
      </Card>
    </div>
  );
}
