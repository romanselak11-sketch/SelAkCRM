import { LIST_PAGE_SIZES, DEFAULT_LIST_PAGE_SIZE, type ListPageSize, visibleListPages } from '../utils/listPagination';
import { Btn } from './Btn';
import { PaginationControls } from './PaginationControls';
import { ScrollableChoiceList } from './ScrollableChoiceList';

const PAGE_SIZE_OPTIONS = LIST_PAGE_SIZES.map((n) => ({
  value: String(n),
  label: String(n),
}));

export type ListPaginationFooterProps = {
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  navAriaLabel: string;
  limit?: ListPageSize;
  onLimitChange?: (limit: ListPageSize) => void;
};

export function ListPaginationFooter({
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  navAriaLabel,
}: ListPaginationFooterProps) {
  const pageSize = limit ?? DEFAULT_LIST_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pagesCenter = (
    <div className="pagination-controls__pages" role="list">
      {visibleListPages(page, totalPages).map((entry, i) =>
        entry === 'gap' ? (
          <span key={`gap-${i}`} className="audit-pagination-gap" aria-hidden>
            …
          </span>
        ) : (
          <Btn
            key={entry}
            size="sm"
            softActive={entry === page}
            className="audit-pagination-page"
            role="listitem"
            onClick={() => onPageChange(entry)}
            aria-current={entry === page ? 'page' : undefined}
          >
            {entry}
          </Btn>
        ),
      )}
    </div>
  );

  const footerClass =
    total > 0 ? 'audit-footer' : 'audit-footer audit-footer--page-size-only';

  return (
    <div className={footerClass}>
      {total > 0 ? (
        <div className="audit-pagination-center">
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            ariaLabel={navAriaLabel}
            center={pagesCenter}
          />
        </div>
      ) : null}
      {limit != null && onLimitChange ? (
        <div className="audit-footer__page-size">
          <ScrollableChoiceList
            aria-label="Записей на странице"
            value={String(limit)}
            onChange={(v) => onLimitChange(Number(v) as ListPageSize)}
            options={PAGE_SIZE_OPTIONS}
            placeholder="Записей"
            clearable={false}
            visibleRows={3}
          />
        </div>
      ) : null}
    </div>
  );
}
