import { describe, expect, it } from 'vitest';
import { hasAnyPermission, hasPermission } from './permissions';

describe('hasPermission', () => {
  it('возвращает false без пользователя или прав', () => {
    expect(hasPermission(null, 'nav.home')).toBe(false);
    expect(hasPermission({ permissions: [] }, 'nav.home')).toBe(false);
  });

  it('проверяет наличие ключа', () => {
    const me = { permissions: ['nav.home', 'tasks.act'] };
    expect(hasPermission(me, 'nav.home')).toBe(true);
    expect(hasPermission(me, 'nav.analytics')).toBe(false);
  });

  it('hasAnyPermission — хотя бы одно из списка', () => {
    const me = { permissions: ['policies.create'] };
    expect(hasAnyPermission(me, ['nav.companies', 'policies.create'])).toBe(true);
    expect(hasAnyPermission(me, ['nav.companies', 'nav.clients'])).toBe(false);
  });
});
