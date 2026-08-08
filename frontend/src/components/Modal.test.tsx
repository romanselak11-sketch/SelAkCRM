/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Modal } from './Modal';

describe('Modal', () => {
  it('возвращает фокус на триггер после закрытия', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'Открыть';
    document.body.appendChild(trigger);
    trigger.focus();

    const root = createRoot(host);
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <Modal open title="Диалог" onClose={onClose}>
          <button type="button">Внутри</button>
        </Modal>,
      );
    });

    expect(document.body.querySelector('.modal-panel')).not.toBeNull();

    await act(async () => {
      root.render(
        <Modal open={false} title="Диалог" onClose={onClose}>
          <button type="button">Внутри</button>
        </Modal>,
      );
    });

    expect(document.activeElement).toBe(trigger);

    await act(async () => {
      root.unmount();
    });
    host.remove();
    trigger.remove();
  });
});
