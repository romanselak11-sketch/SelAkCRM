import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LicenseActivation } from './LicenseActivation';

const noop = () => undefined;

describe('LicenseActivation', () => {
  it('без ключа просит только ключ', () => {
    const html = renderToStaticMarkup(
      <LicenseActivation status="blocked" requestCode={null} onChanged={noop} />,
    );
    expect(html).toContain('Лицензионный ключ');
    expect(html).not.toContain('Код запроса');
    expect(html).not.toContain('Код активации от поставщика');
  });

  it('после ввода ключа показывает обмен кодами двумя шагами', () => {
    const html = renderToStaticMarkup(
      <LicenseActivation
        status="pending_activation"
        requestCode="SAKREQ-xyz"
        onChanged={noop}
      />,
    );
    expect(html).toContain('SAKREQ-xyz');
    expect(html).toContain('Код активации от поставщика');
    expect(html.indexOf('Отправьте код запроса')).toBeLessThan(
      html.indexOf('Вставьте код активации'),
    );
  });

  it('не предлагает обмен кодами, пока код запроса не получен', () => {
    const html = renderToStaticMarkup(
      <LicenseActivation status="pending_activation" requestCode={null} onChanged={noop} />,
    );
    expect(html).toContain('Лицензионный ключ');
    expect(html).toContain('Вставьте ключ сюда');
    expect(html).not.toContain('Вставьте код активации');
  });
});
