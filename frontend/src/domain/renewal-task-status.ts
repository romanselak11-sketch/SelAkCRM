/** Статусы задач продления (совпадают с API `/home/renewal-tasks`). */

export type RenewalTaskStatusApi =
  | 'IN_PROGRESS'
  | 'AWAITING_FEEDBACK'
  | 'POSTPONED'
  | 'AWAITING_ACTION'
  | 'RENEWED'
  | 'CLIENT_DECLINED';

export const RENEWAL_STATUS_LABELS: Record<RenewalTaskStatusApi, string> = {
  IN_PROGRESS: 'В работу',
  AWAITING_FEEDBACK: 'Ожидание обратной связи',
  POSTPONED: 'Отложена',
  AWAITING_ACTION: 'Ожидает действий',
  RENEWED: 'Завершена',
  CLIENT_DECLINED: 'Отказ клиента',
};

export function renewalStatusBadgeClass(status: RenewalTaskStatusApi): string {
  return `task-status-badge task-status-badge--${status.toLowerCase().replace(/_/g, '-')}`;
}

/**
 * Workflow-действия (отложить / отказ) доступны при любом статусе,
 * в том числе для повторного открытия завершённых и отклонённых задач.
 */
export function canActOnRenewalTask(_status: RenewalTaskStatusApi): boolean {
  return true;
}

/**
 * Повторное оформление нового полиса запрещено для уже завершённой задачи:
 * правим оформленный полис или сначала меняем статус (отложить / отказ).
 */
export function canRenewRenewalTask(status: RenewalTaskStatusApi): boolean {
  return status !== 'RENEWED';
}

/** Редактирование полиса из задачи. */
export function canEditRenewedRenewalTask(
  meOrRole: { permissions?: string[] | null } | string | null | undefined,
): boolean {
  if (meOrRole == null) return false;
  if (typeof meOrRole === 'string') {
    // legacy: роль без permissions — прежнее поведение
    return meOrRole === 'SUPER_ADMIN' || meOrRole === 'SUPER_MANAGER';
  }
  return Boolean(meOrRole.permissions?.includes('tasks.edit_policy'));
}

/**
 * ID полиса для редактирования из задачи.
 * Если есть оформленный (после продления) — он, иначе исходный.
 */
export function resolveRenewalTaskEditablePolicyId(task: {
  status: RenewalTaskStatusApi;
  policyId: string;
  renewedPolicyId?: string | null;
  renewedPolicy?: { id: string } | null;
}): string {
  return task.renewedPolicy?.id ?? task.renewedPolicyId ?? task.policyId;
}

/** На завершённой задаче главное действие — правка оформленного полиса. */
export function isRenewalTaskEditPrimary(status: RenewalTaskStatusApi): boolean {
  return status === 'RENEWED';
}
