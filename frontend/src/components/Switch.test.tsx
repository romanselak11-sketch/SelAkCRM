import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Switch } from './Switch';

describe('Switch', () => {
  it('рендерит role=switch и подпись', () => {
    const html = renderToStaticMarkup(
      <Switch label="Раздел: Клиенты" checked={false} onChange={() => undefined} />,
    );
    expect(html).toContain('role="switch"');
    expect(html).toContain('Раздел: Клиенты');
    expect(html).toContain('switch__track');
  });

  it('отмечает включённое состояние', () => {
    const html = renderToStaticMarkup(
      <Switch label="Вкл" checked onChange={() => undefined} />,
    );
    expect(html).toContain('checked');
    expect(html).toContain('aria-checked="true"');
  });
});
