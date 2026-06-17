export type RenewalTaskCommentKind = 'POSTPONE' | 'AWAITING_FEEDBACK' | 'DECLINE';

export type RenewalTaskCommentEntry = {
  createdAt: string;
  kind: RenewalTaskCommentKind;
  text: string;
};

export const RENEWAL_COMMENT_KIND_LABELS: Record<RenewalTaskCommentKind, string> = {
  POSTPONE: 'Отложена',
  AWAITING_FEEDBACK: 'Ожидание обратной связи',
  DECLINE: 'Отказ клиента',
};
