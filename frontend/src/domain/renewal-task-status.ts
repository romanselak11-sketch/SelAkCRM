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

/** Статусы, в которых можно отложить, продлить или зафиксировать отказ. */
export function canActOnRenewalTask(status: RenewalTaskStatusApi): boolean {
  return (
    status === 'IN_PROGRESS' ||
    status === 'AWAITING_ACTION' ||
    status === 'POSTPONED' ||
    status === 'AWAITING_FEEDBACK'
  );
}

/** Редактирование оформленного полиса завершённой задачи (супер-админ / супер-менеджер). */
export function canEditRenewedRenewalTask(role: string | undefined): boolean {
  return role === 'SUPER_ADMIN' || role === 'SUPER_MANAGER';
}

/** ID полиса для редактирования завершённой задачи: новый → исходный. */
export function resolveRenewalTaskEditablePolicyId(task: {
  status: RenewalTaskStatusApi;
  policyId: string;
  renewedPolicyId?: string | null;
  renewedPolicy?: { id: string } | null;
}): string | undefined {
  if (task.status !== 'RENEWED') return undefined;
  return task.renewedPolicy?.id ?? task.renewedPolicyId ?? task.policyId;
}
