import { describe, expect, it } from 'vitest';
import { shouldShowFloatingHorizontalScroll } from './horizontal-scroll-visibility';

describe('shouldShowFloatingHorizontalScroll', () => {
  const windowHeight = 800;

  it('скрывает без горизонтального переполнения', () => {
    expect(shouldShowFloatingHorizontalScroll({ top: 100, bottom: 500 }, windowHeight, false)).toBe(
      false,
    );
  });

  it('показывает, когда низ таблицы за пределами окна', () => {
    expect(shouldShowFloatingHorizontalScroll({ top: 100, bottom: 1200 }, windowHeight, true)).toBe(
      true,
    );
  });

  it('скрывает, когда нативный скролл уже виден', () => {
    expect(shouldShowFloatingHorizontalScroll({ top: 100, bottom: 760 }, windowHeight, true)).toBe(
      false,
    );
  });

  it('скрывает, когда таблица полностью выше окна', () => {
    expect(shouldShowFloatingHorizontalScroll({ top: -400, bottom: -50 }, windowHeight, true)).toBe(
      false,
    );
  });

  it('скрывает, когда таблица полностью ниже окна', () => {
    expect(shouldShowFloatingHorizontalScroll({ top: 900, bottom: 1400 }, windowHeight, true)).toBe(
      false,
    );
  });
});
