import type { KeyboardEvent } from 'react';

/** Enter / Space для строк таблицы с role="button". */
export function activateOnEnterOrSpace(
  event: KeyboardEvent<HTMLElement>,
  activate: () => void,
): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    activate();
  }
}
