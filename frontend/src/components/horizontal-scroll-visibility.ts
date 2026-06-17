/** Показывать ли фиксированную полосу горизонтального скролла. */
export function shouldShowFloatingHorizontalScroll(
  viewportRect: Pick<DOMRectReadOnly, 'top' | 'bottom'>,
  windowHeight: number,
  hasOverflow: boolean,
): boolean {
  if (!hasOverflow) return false;
  const inView = viewportRect.top < windowHeight && viewportRect.bottom > 0;
  if (!inView) return false;
  // Нативный скролл — у нижнего края контейнера таблицы; если он в окне — дублировать не нужно.
  const nativeScrollbarVisible = viewportRect.bottom <= windowHeight;
  return !nativeScrollbarVisible;
}
