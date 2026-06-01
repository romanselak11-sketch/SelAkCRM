// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { lockPageScroll, resetPageScrollLock, unlockPageScroll } from './pageScrollLock';

describe('pageScrollLock', () => {
  beforeEach(() => {
    resetPageScrollLock();
  });

  it('блокирует и разблокирует прокрутку', () => {
    lockPageScroll();
    expect(document.documentElement.classList.contains('modal-scroll-lock')).toBe(true);
    unlockPageScroll();
    expect(document.documentElement.classList.contains('modal-scroll-lock')).toBe(false);
  });

  it('учитывает вложенные модалки', () => {
    lockPageScroll();
    lockPageScroll();
    unlockPageScroll();
    expect(document.documentElement.classList.contains('modal-scroll-lock')).toBe(true);
    unlockPageScroll();
    expect(document.documentElement.classList.contains('modal-scroll-lock')).toBe(false);
  });
});
