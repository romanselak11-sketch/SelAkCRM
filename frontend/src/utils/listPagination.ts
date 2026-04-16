export const LIST_PAGE_SIZES = [10, 25, 50] as const;
export type ListPageSize = (typeof LIST_PAGE_SIZES)[number];

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: ListPageSize;
};

export function buildListQueryString(page: number, limit: number, q?: string): string {
  const p = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const trimmed = (q ?? '').trim();
  if (trimmed) p.set('q', trimmed);
  return p.toString();
}

export function visibleListPages(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const near = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...near].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev > 0 && p - prev > 1) out.push('gap');
    out.push(p);
    prev = p;
  }
  return out;
}
