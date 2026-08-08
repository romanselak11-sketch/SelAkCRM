import type { RenewalTaskStatusApi } from '../domain/renewal-task-status';
import {
  RENEWAL_STATUS_LABELS,
  renewalStatusBadgeClass,
} from '../domain/renewal-task-status';

export function TaskStatusBadge({ status }: { status: RenewalTaskStatusApi }) {
  return (
    <span className={renewalStatusBadgeClass(status)}>
      <span className="task-status-badge__dot" aria-hidden="true" />
      {RENEWAL_STATUS_LABELS[status]}
    </span>
  );
}
