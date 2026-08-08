import type { RenewalTaskStatusApi } from './renewal-task-status';

type CommentFields = {
  status: RenewalTaskStatusApi;
  declineReason?: string | null;
  feedbackComment?: string | null;
  postponeComment?: string | null;
};

/** Актуальный комментарий задачи для превью в таблице реестра. */
export function renewalTaskCommentPreview(task: CommentFields): string {
  let raw: string | null | undefined;
  switch (task.status) {
    case 'CLIENT_DECLINED':
      raw = task.declineReason;
      break;
    case 'AWAITING_FEEDBACK':
      raw = task.feedbackComment;
      break;
    case 'POSTPONED':
      raw = task.postponeComment;
      break;
    default:
      raw = task.postponeComment || task.feedbackComment || task.declineReason;
  }
  const text = raw?.trim();
  return text ? text : '—';
}
