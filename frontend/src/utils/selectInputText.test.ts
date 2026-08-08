import { describe, expect, it, vi } from 'vitest';
import { selectInputText } from './selectInputText';

describe('selectInputText', () => {
  it('вызывает select() у элемента', () => {
    const select = vi.fn();
    selectInputText({ select } as unknown as HTMLInputElement);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it('не бросает, если select недоступен', () => {
    expect(() =>
      selectInputText({
        select: () => {
          throw new Error('unsupported');
        },
      } as unknown as HTMLInputElement),
    ).not.toThrow();
  });
});
