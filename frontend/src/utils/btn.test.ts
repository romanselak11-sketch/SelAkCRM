import { describe, expect, it } from 'vitest';
import { buildBtnClassName } from './btn';

describe('buildBtnClassName', () => {
  it('по умолчанию — базовый btn', () => {
    expect(buildBtnClassName()).toBe('btn');
  });

  it('собирает вариант, размер и модификаторы', () => {
    expect(buildBtnClassName({ variant: 'primary', size: 'sm' })).toBe('btn btn--primary btn--sm');
    expect(buildBtnClassName({ variant: 'ghost', size: 'icon' })).toBe('btn btn--ghost btn--icon');
    expect(
      buildBtnClassName({
        variant: 'ghost',
        size: 'sm',
        pill: true,
        softActive: true,
      }),
    ).toBe('btn btn--ghost btn--sm btn--pill btn--soft-active');
  });

  it('danger-soft и className', () => {
    expect(buildBtnClassName({ variant: 'danger-soft', className: 'u-mt-5' })).toBe(
      'btn btn--danger-soft u-mt-5',
    );
  });
});
