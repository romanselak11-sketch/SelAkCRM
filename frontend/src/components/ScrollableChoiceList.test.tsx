/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { ScrollableChoiceList } from './ScrollableChoiceList';

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('ScrollableChoiceList', () => {
  it('без clearable не показывает пункт сброса', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(
      <ScrollableChoiceList
        value="25"
        onChange={() => undefined}
        options={[
          { value: '10', label: '10' },
          { value: '25', label: '25' },
        ]}
        placeholder="Записей"
        clearable={false}
      />,
    );
    await flush();

    const trigger = host.querySelector('button.scrollable-choice__trigger') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    expect(trigger.textContent).toContain('25');

    await act(async () => {
      trigger.click();
    });
    await flush();

    const options = [...document.body.querySelectorAll('[role="option"]')].map((el) => el.textContent);
    expect(options).toEqual(['10', '25']);
    expect(options).not.toContain('Записей');
    expect(document.body.querySelector('.scrollable-choice__list')?.parentElement).toBe(document.body);

    root.unmount();
    host.remove();
  });

  it('с clearable показывает placeholder как сброс', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(
      <ScrollableChoiceList
        value=""
        onChange={() => undefined}
        options={[{ value: 'a', label: 'A' }]}
        placeholder="Не выбрано"
        clearable
      />,
    );
    await flush();

    const trigger = host.querySelector('button.scrollable-choice__trigger') as HTMLButtonElement;
    await act(async () => {
      trigger.click();
    });
    await flush();

    const options = [...document.body.querySelectorAll('[role="option"]')].map((el) => el.textContent);
    expect(options[0]).toBe('Не выбрано');
    expect(options).toContain('A');
    expect(host.contains(document.body.querySelector('.scrollable-choice__list'))).toBe(false);

    root.unmount();
    host.remove();
  });
});
