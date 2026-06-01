/** Парсинг и форматирование дат в локальном календаре (без UTC-сдвига). */

export function parseLocalYMD(s: string): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  return localDateFromParts(d, m, y);
}

export function toLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type LocalDateRangeYmd = { from: string; to: string };

export function presetToday(baseDate: Date = new Date()): LocalDateRangeYmd {
  const ymd = toLocalYMD(baseDate);
  return { from: ymd, to: ymd };
}

export function presetYesterday(baseDate: Date = new Date()): LocalDateRangeYmd {
  const d = new Date(baseDate);
  d.setDate(d.getDate() - 1);
  const ymd = toLocalYMD(d);
  return { from: ymd, to: ymd };
}

/** Последние 7 дней, включая базовый день. */
export function presetWeek(baseDate: Date = new Date()): LocalDateRangeYmd {
  const to = new Date(baseDate);
  const from = new Date(baseDate);
  from.setDate(from.getDate() - 6);
  return { from: toLocalYMD(from), to: toLocalYMD(to) };
}

/** С первого числа месяца по базовый день включительно. */
export function presetMonthCalendar(baseDate: Date = new Date()): LocalDateRangeYmd {
  const to = new Date(baseDate);
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from: toLocalYMD(from), to: toLocalYMD(to) };
}

/** Отображение в поле: «19 мая 2026 г.» */
export function formatLocalDateRuLong(d: Date): string {
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Редактируемый вид при фокусе: ДД.ММ.ГГГГ */
export function localYmdToDotted(ymd: string): string {
  const d = parseLocalYMD(ymd);
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}`;
}

/** Символы ручного ввода: цифры, точка и запятая как разделители. */
export function sanitizeManualDateInput(raw: string): string {
  return raw.replace(/[^\d.,]/g, '');
}

/**
 * Ручной ввод: ДДММГГГГ, ДД.ММ.ГГГГ или ДД,ММ,ГГГГ.
 * Неполный ввод (например 7 цифр) не парсится — только на blur/Enter.
 */
export function parseManualDateInput(raw: string): Date | undefined {
  const s = raw.trim();
  if (!s) return undefined;

  const dotted = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotted) {
    return localDateFromParts(Number(dotted[1]), Number(dotted[2]), Number(dotted[3]));
  }

  const comma = s.match(/^(\d{1,2}),(\d{1,2}),(\d{4})$/);
  if (comma) {
    return localDateFromParts(Number(comma[1]), Number(comma[2]), Number(comma[3]));
  }

  if (/^\d{8}$/.test(s)) {
    return localDateFromParts(
      Number(s.slice(0, 2)),
      Number(s.slice(2, 4)),
      Number(s.slice(4, 8)),
    );
  }

  return undefined;
}

export function isLocalDateWithinBounds(
  d: Date,
  minYmd?: string,
  maxYmd?: string,
): boolean {
  const day = startOfLocalDay(d);
  const minD = minYmd ? parseLocalYMD(minYmd) : undefined;
  const maxD = maxYmd ? parseLocalYMD(maxYmd) : undefined;
  if (minD && day < startOfLocalDay(minD)) return false;
  if (maxD && day > startOfLocalDay(maxD)) return false;
  return true;
}

function localDateFromParts(day: number, month: number, year: number): Date | undefined {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return undefined;
  }
  return dt;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
