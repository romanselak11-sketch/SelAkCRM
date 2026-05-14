export function formatIsoDateRu(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw || '—';
  return `${match[3]}.${match[2]}.${match[1]}`;
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
