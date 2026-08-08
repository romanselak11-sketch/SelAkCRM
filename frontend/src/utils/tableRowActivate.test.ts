import { describe, expect, it, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { activateOnEnterOrSpace } from './tableRowActivate';

function keyEvent(key: string): KeyboardEvent<HTMLElement> {
  return {
    key,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent<HTMLElement>;
}

describe('activateOnEnterOrSpace', () => {
  it('активирует по Enter и Space', () => {
    const activate = vi.fn();
    const enter = keyEvent('Enter');
    activateOnEnterOrSpace(enter, activate);
    expect(enter.preventDefault).toHaveBeenCalled();
    expect(activate).toHaveBeenCalledTimes(1);

    const space = keyEvent(' ');
    activateOnEnterOrSpace(space, activate);
    expect(space.preventDefault).toHaveBeenCalled();
    expect(activate).toHaveBeenCalledTimes(2);
  });

  it('игнорирует другие клавиши', () => {
    const activate = vi.fn();
    const ev = keyEvent('Tab');
    activateOnEnterOrSpace(ev, activate);
    expect(ev.preventDefault).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });
});
