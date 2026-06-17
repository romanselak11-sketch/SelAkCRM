export type RenewalTaskDisplay =
  | { kind: 'days'; value: number }
  | { kind: 'hm'; value: string }
  | { kind: 'overdue'; value: string }
  | { kind: 'completed'; value: string };

function formatCompletedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Текст для колонки «До окончания» / срока задачи. */
export function formatRenewalTaskDisplay(display: RenewalTaskDisplay): string {
  if (display.kind === 'days') {
    return `${display.value} дн.`;
  }
  if (display.kind === 'overdue') {
    return `Просрочена на ${display.value}`;
  }
  if (display.kind === 'completed') {
    return formatCompletedAt(display.value);
  }
  return display.value;
}

export function isRenewalTaskOverdue(display: RenewalTaskDisplay): boolean {
  return display.kind === 'overdue';
}

export function isRenewalTaskCompleted(display: RenewalTaskDisplay): boolean {
  return display.kind === 'completed';
}

/** CSS-класс подсветки срока в таблице. */
export function renewalTaskDeadlineClass(display: RenewalTaskDisplay): string | undefined {
  if (display.kind === 'overdue') return 'renewal-task-deadline--overdue';
  if (display.kind === 'completed') return 'renewal-task-deadline--completed';
  return undefined;
}
