import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OverflowMenu } from './OverflowMenu';

describe('OverflowMenu', () => {
  it('рендерит кнопку ⋯ с aria-label', () => {
    const html = renderToStaticMarkup(
      <OverflowMenu
        aria-label="Действия для SAK-1"
        items={[{ id: 'a', label: 'Показать ключ', onSelect: () => undefined }]}
      />,
    );
    expect(html).toContain('overflow-menu');
    expect(html).toContain('aria-label="Действия для SAK-1"');
    expect(html).toContain('⋯');
    expect(html).toContain('btn--icon');
  });
});
