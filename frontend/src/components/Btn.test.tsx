import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Btn } from './Btn';

describe('Btn', () => {
  it('рендерит primary sm', () => {
    const html = renderToStaticMarkup(
      <Btn variant="primary" size="sm">
        Ок
      </Btn>,
    );
    expect(html).toContain('btn btn--primary btn--sm');
    expect(html).toContain('type="button"');
    expect(html).toContain('Ок');
  });

  it('поддерживает icon + ghost и type=submit', () => {
    const html = renderToStaticMarkup(
      <Btn variant="ghost" size="icon" type="submit" aria-label="Добавить">
        +
      </Btn>,
    );
    expect(html).toContain('btn btn--ghost btn--icon');
    expect(html).toContain('type="submit"');
  });

  it('pill + softActive для сегментов', () => {
    const html = renderToStaticMarkup(
      <Btn variant="ghost" size="sm" pill softActive>
        Сегодня
      </Btn>,
    );
    expect(html).toContain('btn--pill');
    expect(html).toContain('btn--soft-active');
  });
});
