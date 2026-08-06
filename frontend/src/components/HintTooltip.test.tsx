/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { FieldHint } from './FieldHint';
import { HintTooltip } from './HintTooltip';

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
}

describe('HintTooltip / FieldHint', () => {
  it('рендерит кнопку «?» и скрытый текст подсказки', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(<HintTooltip ariaLabel="О разделе">Справочник клиентов</HintTooltip>);
    await flush();

    const btn = host.querySelector('button.hint-tip__btn');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('aria-label')).toBe('О разделе');
    expect(btn?.textContent).toBe('?');
    expect(host.querySelector('[role="tooltip"]')?.textContent).toBe('Справочник клиентов');

    root.unmount();
    host.remove();
  });

  it('FieldHint помечает aria-label для поля', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(<FieldHint id="phone-hint">Например: +79001234567</FieldHint>);
    await flush();

    expect(host.querySelector('button.hint-tip__btn')?.getAttribute('aria-label')).toBe(
      'Подсказка к полю',
    );
    expect(host.querySelector('#phone-hint')?.textContent).toBe('Например: +79001234567');

    root.unmount();
    host.remove();
  });
});
