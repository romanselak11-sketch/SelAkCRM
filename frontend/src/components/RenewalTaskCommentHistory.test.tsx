/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { RenewalTaskCommentHistory } from './RenewalTaskCommentHistory';

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
}

describe('RenewalTaskCommentHistory', () => {
  it('не рендерит историю при одном комментарии', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(
      <RenewalTaskCommentHistory
        entries={[
          {
            createdAt: '2026-08-06T16:52:00.000Z',
            kind: 'POSTPONE',
            text: 'Один комментарий',
          },
        ]}
      />,
    );
    await flush();
    expect(host.querySelector('.renewal-task-comment-history')).toBeNull();
    root.unmount();
    host.remove();
  });

  it('рендерит историю при двух и более комментариях с меткой действия, не статуса', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(
      <RenewalTaskCommentHistory
        entries={[
          {
            createdAt: '2026-08-06T16:50:00.000Z',
            kind: 'POSTPONE',
            text: 'Первый',
          },
          {
            createdAt: '2026-08-06T16:52:00.000Z',
            kind: 'DECLINE',
            text: 'Второй',
          },
        ]}
      />,
    );
    await flush();
    expect(host.querySelector('.renewal-task-comment-history')).not.toBeNull();
    const kinds = [...host.querySelectorAll('.renewal-task-comment-history__kind')].map(
      (el) => el.textContent,
    );
    expect(kinds).toContain('Отсрочка');
    expect(kinds).toContain('Отказ');
    expect(kinds).not.toContain('Отложена');
    root.unmount();
    host.remove();
  });
});
