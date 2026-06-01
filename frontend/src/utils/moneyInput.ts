import { sanitizeMoneyInput } from './fieldInput';

const moneyFieldFmt = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function normalizeMoneyForApi(raw: string): string {
  const cleaned = sanitizeMoneyInput(raw).replace(/\s+/g, '').replace(',', '.');
  if (!cleaned) return '';
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return '';
  return amount.toFixed(2);
}

export function formatMoneyForField(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  const normalized = normalizeMoneyForApi(String(raw));
  if (!normalized) return '';
  return moneyFieldFmt.format(Number(normalized));
}
