/** Типы ввода для полей форм: фильтрация символов. */

export type FieldInputKind =
  | 'text'
  | 'personName'
  | 'phone'
  | 'email'
  | 'url'
  | 'money'
  | 'decimal'
  | 'login';

/** Короткое сообщение во всплывающей подсказке при неверном символе. */
export const FIELD_REJECT_MESSAGES: Record<FieldInputKind, string | null> = {
  text: null,
  personName: 'Здесь только буквы',
  phone: 'Только цифры и знак +',
  email: 'Email без пробелов',
  url: 'Ссылка без пробелов',
  money: 'Только цифры',
  decimal: 'Только цифры',
  login: 'Латиница, цифры и ._-',
};

export function fieldInputMode(
  kind: FieldInputKind,
): 'tel' | 'decimal' | 'email' | 'url' | undefined {
  switch (kind) {
    case 'phone':
      return 'tel';
    case 'money':
    case 'decimal':
      return 'decimal';
    case 'email':
      return 'email';
    case 'url':
      return 'url';
    default:
      return undefined;
  }
}

export function sanitizeText(raw: string): string {
  return [...raw]
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');
}

export function sanitizePersonName(raw: string): string {
  return [...sanitizeText(raw)]
    .filter((ch) => /\p{L}/u.test(ch) || /[\s\-'.]/.test(ch))
    .join('');
}

export function sanitizePhone(raw: string): string {
  return sanitizeText(raw).replace(/[^\d+\s()-]/g, '');
}

function sanitizeEmail(raw: string): string {
  return sanitizeText(raw).replace(/\s/g, '');
}

function sanitizeUrl(raw: string): string {
  return sanitizeText(raw).replace(/\s/g, '');
}

function sanitizeLogin(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._-]/g, '');
}

export function sanitizeDecimal(raw: string): string {
  let out = '';
  let sep = false;
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
    } else if ((ch === ',' || ch === '.') && !sep) {
      out += ch;
      sep = true;
    }
  }
  return out;
}

export function sanitizeMoneyInput(raw: string): string {
  return raw.replace(/[^\d.,\s]/g, '');
}

export function sanitizeFieldInput(kind: FieldInputKind, raw: string): string {
  switch (kind) {
    case 'text':
      return sanitizeText(raw);
    case 'personName':
      return sanitizePersonName(raw);
    case 'phone':
      return sanitizePhone(raw);
    case 'email':
      return sanitizeEmail(raw);
    case 'url':
      return sanitizeUrl(raw);
    case 'login':
      return sanitizeLogin(raw);
    case 'decimal':
      return sanitizeDecimal(raw);
    case 'money':
      return sanitizeMoneyInput(raw);
    default:
      return raw;
  }
}

export type FieldInputApplyResult = {
  value: string;
  /** Пользователь ввёл символ, который мы не приняли. */
  rejected: boolean;
};

export function applyFieldInput(kind: FieldInputKind, raw: string): FieldInputApplyResult {
  const value = sanitizeFieldInput(kind, raw);
  if (value === raw) {
    return { value, rejected: false };
  }
  if (kind === 'text') {
    return { value, rejected: false };
  }
  return { value, rejected: raw.length > 0 };
}
