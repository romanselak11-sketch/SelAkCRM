/** Блокировка прокрутки страницы при открытых модалках (счётчик вложенности). */
let lockCount = 0;

export function lockPageScroll(): void {
  lockCount += 1;
  if (lockCount === 1) {
    document.documentElement.classList.add('modal-scroll-lock');
  }
}

export function unlockPageScroll(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.documentElement.classList.remove('modal-scroll-lock');
    document.body.style.overflow = '';
  }
}

/** Сброс после навигации, если блокировка «залипла». */
export function resetPageScrollLock(): void {
  lockCount = 0;
  document.documentElement.classList.remove('modal-scroll-lock');
  document.body.style.overflow = '';
}
