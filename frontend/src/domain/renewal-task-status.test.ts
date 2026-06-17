import { describe, expect, it } from 'vitest';
import { canActOnRenewalTask, canEditRenewedRenewalTask, resolveRenewalTaskEditablePolicyId } from './renewal-task-status';

describe('canActOnRenewalTask', () => {
  it('разрешает действия для отложенной задачи', () => {
    expect(canActOnRenewalTask('POSTPONED')).toBe(true);
  });

  it('запрещает действия для завершённой', () => {
    expect(canActOnRenewalTask('RENEWED')).toBe(false);
  });
});

describe('canEditRenewedRenewalTask', () => {
  it('разрешает супер-админу и супер-менеджеру', () => {
    expect(canEditRenewedRenewalTask('SUPER_ADMIN')).toBe(true);
    expect(canEditRenewedRenewalTask('SUPER_MANAGER')).toBe(true);
  });

  it('запрещает менеджеру', () => {
    expect(canEditRenewedRenewalTask('MANAGER')).toBe(false);
  });
});

describe('resolveRenewalTaskEditablePolicyId', () => {
  it('берёт новый полис, если он есть', () => {
    expect(
      resolveRenewalTaskEditablePolicyId({
        status: 'RENEWED',
        policyId: 'old',
        renewedPolicyId: 'renewed-id',
        renewedPolicy: { id: 'renewed-obj' },
      }),
    ).toBe('renewed-obj');
  });

  it('берёт renewedPolicyId без объекта', () => {
    expect(
      resolveRenewalTaskEditablePolicyId({
        status: 'RENEWED',
        policyId: 'old',
        renewedPolicyId: 'renewed-id',
      }),
    ).toBe('renewed-id');
  });

  it('для завершённой без нового полиса — исходный', () => {
    expect(
      resolveRenewalTaskEditablePolicyId({
        status: 'RENEWED',
        policyId: 'old',
      }),
    ).toBe('old');
  });

  it('для незавершённой — undefined', () => {
    expect(
      resolveRenewalTaskEditablePolicyId({
        status: 'IN_PROGRESS',
        policyId: 'old',
      }),
    ).toBeUndefined();
  });
});
