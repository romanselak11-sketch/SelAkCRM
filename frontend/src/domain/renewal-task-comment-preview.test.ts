import { describe, expect, it } from 'vitest';
import { renewalTaskCommentPreview } from './renewal-task-comment-preview';

describe('renewalTaskCommentPreview', () => {
  it('для отказа берёт причину отказа', () => {
    expect(
      renewalTaskCommentPreview({
        status: 'CLIENT_DECLINED',
        declineReason: ' Дорого ',
        postponeComment: 'не то',
      }),
    ).toBe('Дорого');
  });

  it('для ожидания обратной связи берёт feedbackComment', () => {
    expect(
      renewalTaskCommentPreview({
        status: 'AWAITING_FEEDBACK',
        feedbackComment: 'Ждём документы',
      }),
    ).toBe('Ждём документы');
  });

  it('для отложенной берёт postponeComment', () => {
    expect(
      renewalTaskCommentPreview({
        status: 'POSTPONED',
        postponeComment: 'Перезвонить',
      }),
    ).toBe('Перезвонить');
  });

  it('без комментария возвращает тире', () => {
    expect(renewalTaskCommentPreview({ status: 'IN_PROGRESS' })).toBe('—');
  });
});
