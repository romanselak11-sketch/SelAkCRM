/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { FieldHint } from './FieldHint';
import { FieldLabel } from './FieldLabel';
import { HintTooltip } from './HintTooltip';
import { ValidatedInput } from './ValidatedInput';

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
}

describe('HintTooltip / FieldHint', () => {
  it('рендерит кнопку «?» и текст подсказки в portal на body', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(<HintTooltip ariaLabel="О разделе">Справочник клиентов</HintTooltip>);
    await flush();

    const btn = host.querySelector('button.btn--hint');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('aria-label')).toBe('О разделе');
    expect(btn?.textContent).toBe('?');

    const tip = document.body.querySelector('[role="tooltip"]');
    expect(tip?.textContent).toBe('Справочник клиентов');
    expect(tip?.parentElement).toBe(document.body);
    expect(host.contains(tip)).toBe(false);

    root.unmount();
    host.remove();
    tip?.remove();
  });

  it('FieldHint помечает aria-label для поля', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(<FieldHint id="phone-hint">Например: +79001234567</FieldHint>);
    await flush();

    expect(host.querySelector('button.btn--hint')?.getAttribute('aria-label')).toBe(
      'Подсказка к полю',
    );
    expect(document.getElementById('phone-hint')?.textContent).toBe('Например: +79001234567');

    root.unmount();
    host.remove();
    document.getElementById('phone-hint')?.remove();
  });

  it('FieldLabel ставит подсказку рядом с названием поля', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(
      <label className="field">
        <FieldLabel hint="Например: admin">Логин</FieldLabel>
        <ValidatedInput kind="login" value="admin" onChange={() => {}} />
      </label>,
    );
    await flush();

    const label = host.querySelector('.field-label');
    expect(label?.textContent).toContain('Логин');
    expect(label?.querySelector('.hint-tip')).not.toBeNull();
    expect(host.querySelector('.field-input-wrap .hint-tip')).toBeNull();
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe('Например: admin');

    root.unmount();
    host.remove();
    document.body.querySelectorAll('[role="tooltip"]').forEach((el) => el.remove());
  });

  it('при фокусе показывает подсказку поверх (portal + open)', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(<HintTooltip>Текст подсказки</HintTooltip>);
    await flush();

    const btn = host.querySelector('button.btn--hint') as HTMLButtonElement;
    const tip = document.body.querySelector('.hint-tip__tooltip');
    expect(btn).not.toBeNull();
    expect(tip).not.toBeNull();
    expect(tip?.classList.contains('hint-tip__tooltip--open')).toBe(false);
    expect(tip?.classList.contains('hint-tip__tooltip--closed')).toBe(true);

    btn.focus();
    await flush();
    // layout effect ставит координаты синхронно после paint microtask
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    expect(document.body.querySelector('.hint-tip__tooltip--open')).not.toBeNull();
    expect(document.body.querySelector('.hint-tip__tooltip--ready')).not.toBeNull();

    btn.blur();
    await flush();
    expect(document.body.querySelector('.hint-tip__tooltip--open')).toBeNull();

    root.unmount();
    host.remove();
    document.body.querySelectorAll('[role="tooltip"]').forEach((el) => el.remove());
  });

  it('позиция подсказки ограничена вьюпортом', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(<HintTooltip>Длинный текст подсказки для проверки clamp</HintTooltip>);
    await flush();

    const btn = host.querySelector('button.btn--hint') as HTMLButtonElement;
    btn.focus();
    await flush();
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const tip = document.body.querySelector('.hint-tip__tooltip--open') as HTMLElement | null;
    expect(tip).not.toBeNull();
    const top = Number.parseFloat(tip!.style.top);
    const left = Number.parseFloat(tip!.style.left);
    expect(Number.isFinite(top)).toBe(true);
    expect(Number.isFinite(left)).toBe(true);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(left).toBeGreaterThanOrEqual(0);

    root.unmount();
    host.remove();
    document.body.querySelectorAll('[role="tooltip"]').forEach((el) => el.remove());
  });
});
