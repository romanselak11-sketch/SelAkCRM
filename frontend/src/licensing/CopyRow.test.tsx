import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CopyRow } from './CopyRow';

describe('CopyRow', () => {
  it('держит значение и кнопку копирования в одной строке', () => {
    const html = renderToStaticMarkup(<CopyRow label="Код запроса" value="SAKREQ-abc" />);
    const row = html.slice(html.indexOf('copy-row'));
    expect(row).toContain('SAKREQ-abc');
    expect(row).toContain('Копировать');
    // Кнопка внутри той же строки, а не отдельным блоком под значением.
    expect(html.indexOf('copy-row__value')).toBeLessThan(html.indexOf('Копировать'));
  });

  it('показывает значение моноширинным и с подписью', () => {
    const html = renderToStaticMarkup(
      <CopyRow label="Отпечаток" value="hw_1" description="Нужен поставщику" />,
    );
    expect(html).toContain('mono copy-row__value');
    expect(html).toContain('Нужен поставщику');
  });

  it('блокирует копирование пустого значения', () => {
    const html = renderToStaticMarkup(<CopyRow label="Код" value="" />);
    expect(html).toContain('disabled');
  });
});
