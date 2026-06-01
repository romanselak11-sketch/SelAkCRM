import { describe, expect, it } from 'vitest';
import { canActOnRenewalTask } from './renewal-task-status';

describe('canActOnRenewalTask', () => {
  it('разрешает действия для отложенной задачи', () => {
    expect(canActOnRenewalTask('POSTPONED')).toBe(true);
  });

  it('запрещает действия для завершённой', () => {
    expect(canActOnRenewalTask('RENEWED')).toBe(false);
  });
});
