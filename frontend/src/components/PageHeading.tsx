import { useId } from 'react';

export type PageHeadingProps = {
  title: string;
  /** Пояснение в подсказке по «?»; если не задано — значок не показывается */
  hint?: string;
};

export function PageHeading({ title, hint }: PageHeadingProps) {
  const tipId = useId();

  if (!hint?.trim()) {
    return (
      <div className="page-titles">
        <h1 className="page-title">{title}</h1>
      </div>
    );
  }

  const text = hint.trim();

  return (
    <div className="page-titles">
      <div className="page-title-row">
        <h1 className="page-title">{title}</h1>
        <span className="page-hint">
          <button
            type="button"
            className="page-hint__btn"
            aria-describedby={tipId}
            aria-label="О разделе"
          >
            ?
          </button>
          <span id={tipId} className="page-hint__tooltip" role="tooltip">
            {text}
          </span>
        </span>
      </div>
    </div>
  );
}
