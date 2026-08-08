import {
  RENEWAL_COMMENT_KIND_LABELS,
  type RenewalTaskCommentEntry,
} from '../domain/renewal-task-comments';

function formatCommentDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type RenewalTaskCommentHistoryProps = {
  entries: RenewalTaskCommentEntry[];
};

export function RenewalTaskCommentHistory({ entries }: RenewalTaskCommentHistoryProps) {
  // Один комментарий уже показан в поле «Комментарий» — историю не дублируем.
  if (entries.length <= 1) return null;

  const sorted = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="renewal-task-comment-history">
      <h3 className="renewal-task-comment-history__title">История комментариев</h3>
      <div className="renewal-task-comment-history__scroll">
        <ol className="renewal-task-comment-history__list">
        {sorted.map((entry, index) => (
          <li key={`${entry.createdAt}-${index}`} className="renewal-task-comment-history__item">
            <div className="renewal-task-comment-history__meta">
              <time dateTime={entry.createdAt}>{formatCommentDate(entry.createdAt)}</time>
              <span className="renewal-task-comment-history__kind">
                {RENEWAL_COMMENT_KIND_LABELS[entry.kind]}
              </span>
            </div>
            <p className="renewal-task-comment-history__text">{entry.text}</p>
          </li>
        ))}
        </ol>
      </div>
    </div>
  );
}
