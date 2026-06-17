import { describe, expect, it } from 'vitest';
import { buildStackClassName } from './Stack';

describe('buildStackClassName', () => {
  it('по умолчанию — колонка с gap-3', () => {
    expect(buildStackClassName({})).toBe('stack stack--gap-3');
  });

  it('собирает модификаторы направления, gap, выравнивания и wrap', () => {
    expect(
      buildStackClassName({
        direction: 'row',
        gap: 4,
        align: 'center',
        justify: 'between',
        wrap: true,
        className: 'extra',
      }),
    ).toBe(
      'stack stack--row stack--gap-4 stack--align-center stack--justify-between stack--wrap extra',
    );
  });
});
