import { describe, expect, it } from 'vitest';
import {
  applyFieldInput,
  sanitizeDecimal,
  sanitizeFieldInput,
  sanitizeMoneyInput,
  sanitizePersonName,
  sanitizePhone,
} from './fieldInput';

describe('sanitizePersonName', () => {
  it('оставляет буквы и пробел', () => {
    expect(sanitizePersonName('Иванов123')).toBe('Иванов');
  });

  it('отбрасывает цифры', () => {
    expect(sanitizeFieldInput('personName', 'Петр2')).toBe('Петр');
  });
});

describe('sanitizePhone', () => {
  it('оставляет цифры и плюс', () => {
    expect(sanitizePhone('+7 (900) abc')).toBe('+7 (900) ');
  });
});

describe('sanitizeDecimal', () => {
  it('один разделитель дробной части', () => {
    expect(sanitizeDecimal('12.3.4')).toBe('12.34');
  });
});

describe('sanitizeMoneyInput', () => {
  it('убирает буквы', () => {
    expect(sanitizeMoneyInput('5 000 руб')).toBe('5 000 ');
  });
});

describe('applyFieldInput', () => {
  it('отмечает отклонение цифр в decimal', () => {
    expect(applyFieldInput('decimal', '12a')).toEqual({ value: '12', rejected: true });
  });

  it('не отмечает отклонение для свободного text', () => {
    expect(applyFieldInput('text', 'кпукп123')).toEqual({ value: 'кпукп123', rejected: false });
  });
});
