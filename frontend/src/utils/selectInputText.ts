/** Выделить всё содержимое input/textarea (фокус / клик по числовым полям). */

export function selectInputText(el: HTMLInputElement | HTMLTextAreaElement): void {
  try {
    el.select();
  } catch {
    /* ignore: некоторые типы (date/time) не поддерживают select() */
  }
}
