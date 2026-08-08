import { describe, expect, it } from 'vitest';
import {
  canActOnRenewalTask,
  canEditRenewedRenewalTask,
  canRenewRenewalTask,
  isRenewalTaskEditPrimary,
  resolveRenewalTaskEditablePolicyId,
} from './renewal-task-status';

describe('canActOnRenewalTask', () => {
  it('разрешает действия для отложенной задачи', () => {
    expect(canActOnRenewalTask('POSTPONED')).toBe(true);
  });

  it('разрешает действия для завершённой и отказа', () => {
    expect(canActOnRenewalTask('RENEWED')).toBe(true);
    expect(canActOnRenewalTask('CLIENT_DECLINED')).toBe(true);
  });
});

describe('canRenewRenewalTask', () => {
  it('разрешает продление для открытых и отказа', () => {
    expect(canRenewRenewalTask('IN_PROGRESS')).toBe(true);
    expect(canRenewRenewalTask('POSTPONED')).toBe(true);
    expect(canRenewRenewalTask('CLIENT_DECLINED')).toBe(true);
  });

  it('запрещает повторное продление завершённой', () => {
    expect(canRenewRenewalTask('RENEWED')).toBe(false);
  });
});

describe('isRenewalTaskEditPrimary', () => {
  it('primary только для завершённой', () => {
    expect(isRenewalTaskEditPrimary('RENEWED')).toBe(true);
    expect(isRenewalTaskEditPrimary('IN_PROGRESS')).toBe(false);
    expect(isRenewalTaskEditPrimary('CLIENT_DECLINED')).toBe(false);
  });
});

describe('canEditRenewedRenewalTask', () => {
  it('разрешает супер-админу и супер-менеджеру', () => {
    expect(canEditRenewedRenewalTask('SUPER_ADMIN')).toBe(true);
    expect(canEditRenewedRenewalTask('SUPER_MANAGER')).toBe(true);
  });

  it('разрешает при праве tasks.edit_policy', () => {
    expect(canEditRenewedRenewalTask({ permissions: ['tasks.edit_policy'] })).toBe(true);
  });

  it('запрещает менеджеру без права', () => {
    expect(canEditRenewedRenewalTask('MANAGER')).toBe(false);
    expect(canEditRenewedRenewalTask({ permissions: ['tasks.act'] })).toBe(false);
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

  it('для незавершённой — исходный полис', () => {
    expect(
      resolveRenewalTaskEditablePolicyId({
        status: 'IN_PROGRESS',
        policyId: 'old',
      }),
    ).toBe('old');
  });

  it('для отказа — исходный полис', () => {
    expect(
      resolveRenewalTaskEditablePolicyId({
        status: 'CLIENT_DECLINED',
        policyId: 'declined-policy',
      }),
    ).toBe('declined-policy');
  });

  it('для отказа после продления — оформленный полис', () => {
    expect(
      resolveRenewalTaskEditablePolicyId({
        status: 'CLIENT_DECLINED',
        policyId: 'old',
        renewedPolicyId: 'renewed-id',
      }),
    ).toBe('renewed-id');
  });
});
