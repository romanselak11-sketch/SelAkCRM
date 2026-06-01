import { describe, expect, it } from 'vitest';
import { formatMoneyForField, normalizeMoneyForApi } from './moneyInput';

describe('normalizeMoneyForApi', () => {
  it('нормализует сумму с пробелами и запятой', () => {
    expect(normalizeMoneyForApi('5 000,5')).toBe('5000.50');
  });

  it('возвращает пустую строку для пустого значения', () => {
    expect(normalizeMoneyForApi('')).toBe('');
    expect(normalizeMoneyForApi('   ')).toBe('');
  });

  it('возвращает 0.00 для нуля', () => {
    expect(normalizeMoneyForApi('0')).toBe('0.00');
  });
});

describe('formatMoneyForField', () => {
  it('форматирует нормализованное значение для поля', () => {
    expect(formatMoneyForField('5000.5')).toBe('5 000,50');
  });

  it('возвращает пустую строку для null/undefined', () => {
    expect(formatMoneyForField(null)).toBe('');
    expect(formatMoneyForField(undefined)).toBe('');
  });
});
