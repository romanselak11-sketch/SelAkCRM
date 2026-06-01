import { describe, expect, it } from 'vitest';
import {
  formatLocalDateRuLong,
  isLocalDateWithinBounds,
  localYmdToDotted,
  parseManualDateInput,
  parseLocalYMD,
  presetMonthCalendar,
  presetToday,
  presetWeek,
  presetYesterday,
  sanitizeManualDateInput,
  toLocalYMD,
} from './localDate';

describe('parseManualDateInput', () => {
  it('парсит ДДММГГГГ', () => {
    const d = parseManualDateInput('19052026');
    expect(d).toBeDefined();
    expect(toLocalYMD(d!)).toBe('2026-05-19');
  });

  it('парсит ДД.ММ.ГГГГ', () => {
    const d = parseManualDateInput('19.05.2026');
    expect(toLocalYMD(d!)).toBe('2026-05-19');
  });

  it('парсит ДД,ММ,ГГГГ', () => {
    const d = parseManualDateInput('19,05,2026');
    expect(toLocalYMD(d!)).toBe('2026-05-19');
  });

  it('отклоняет несуществующую дату', () => {
    expect(parseManualDateInput('31022026')).toBeUndefined();
    expect(parseManualDateInput('29022025')).toBeUndefined();
  });

  it('отклоняет неполный компактный ввод', () => {
    expect(parseManualDateInput('1905202')).toBeUndefined();
  });

  it('отклоняет смешанные разделители', () => {
    expect(parseManualDateInput('19.05,2026')).toBeUndefined();
  });
});

describe('sanitizeManualDateInput', () => {
  it('убирает посторонние символы', () => {
    expect(sanitizeManualDateInput('19a.05b.2026')).toBe('19.05.2026');
  });
});

describe('localYmdToDotted', () => {
  it('форматирует YYYY-MM-DD', () => {
    expect(localYmdToDotted('2026-05-19')).toBe('19.05.2026');
  });
});

describe('isLocalDateWithinBounds', () => {
  it('учитывает min и max включительно', () => {
    const d = parseLocalYMD('2026-05-19')!;
    expect(isLocalDateWithinBounds(d, '2026-05-19', '2026-05-20')).toBe(true);
    expect(isLocalDateWithinBounds(d, '2026-05-20', undefined)).toBe(false);
    expect(isLocalDateWithinBounds(d, undefined, '2026-05-18')).toBe(false);
  });
});

describe('formatLocalDateRuLong', () => {
  it('возвращает длинный русский формат', () => {
    const d = parseLocalYMD('2026-05-19')!;
    expect(formatLocalDateRuLong(d)).toMatch(/19\s+мая\s+2026/);
  });
});

describe('analytics presets', () => {
  const base = new Date(2026, 4, 19); // 19.05.2026 local time

  it('presetToday возвращает текущий день', () => {
    expect(presetToday(base)).toEqual({ from: '2026-05-19', to: '2026-05-19' });
  });

  it('presetYesterday возвращает вчерашний день', () => {
    expect(presetYesterday(base)).toEqual({ from: '2026-05-18', to: '2026-05-18' });
  });

  it('presetWeek возвращает последние 7 дней', () => {
    expect(presetWeek(base)).toEqual({ from: '2026-05-13', to: '2026-05-19' });
  });

  it('presetMonthCalendar возвращает период с начала месяца', () => {
    expect(presetMonthCalendar(base)).toEqual({ from: '2026-05-01', to: '2026-05-19' });
  });
});
