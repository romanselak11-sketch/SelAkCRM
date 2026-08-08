export function formatIsoDateRu(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw || '—';
  return `${match[3]}.${match[2]}.${match[1]}`;
}

/** Дата и время ISO → краткая локаль ru-RU. */
export function formatDateTimeRu(iso: string | null | undefined): string {
  const raw = (iso ?? '').trim();
  if (!raw) return '—';
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(raw));
  } catch {
    return raw;
  }
}

const rubMoneyFmt = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoneyRu(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const normalized = String(value).trim().replace(/\s+/g, '').replace(',', '.');
  if (!normalized) return '—';
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return String(value);
  return rubMoneyFmt.format(amount);
}
