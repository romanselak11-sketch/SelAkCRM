import { LIST_PAGE_SIZES, type ListPageSize, visibleListPages } from '../utils/listPagination';

export type ListPaginationFooterProps = {
  total: number;
  page: number;
  limit: ListPageSize;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: ListPageSize) => void;
  navAriaLabel: string;
};

export function ListPaginationFooter({
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  navAriaLabel,
}: ListPaginationFooterProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className={total > 0 ? 'audit-footer' : 'audit-footer audit-footer--page-size-only'}>
      {total > 0 ? (
        <div className="audit-pagination-center">
          <nav className="audit-pagination-nav" aria-label={navAriaLabel}>
            <div className="audit-pagination-controls">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={page <= 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
              >
                Назад
              </button>
              <div className="audit-pagination-pages" role="list">
                {visibleListPages(page, totalPages).map((entry, i) =>
                  entry === 'gap' ? (
                    <span key={`gap-${i}`} className="audit-pagination-gap" aria-hidden>
                      …
                    </span>
                  ) : (
                    <button
                      key={entry}
                      type="button"
                      role="listitem"
                      className={`btn btn--sm audit-pagination-page${entry === page ? ' audit-pagination-page--current' : ''}`}
                      onClick={() => onPageChange(entry)}
                      aria-current={entry === page ? 'page' : undefined}
                    >
                      {entry}
                    </button>
                  ),
                )}
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              >
                Вперёд
              </button>
            </div>
          </nav>
        </div>
      ) : null}
      <div className="field audit-footer__page-size">
        <select
          aria-label="Записей на странице"
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value) as ListPageSize)}
        >
          {LIST_PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
