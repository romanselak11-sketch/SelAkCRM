import { HintTooltip } from './HintTooltip';

export type PageHeadingProps = {
  title: string;
  /** Пояснение в подсказке по «?»; если не задано — значок не показывается */
  hint?: string;
};

export function PageHeading({ title, hint }: PageHeadingProps) {
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
        <HintTooltip ariaLabel="О разделе" className="page-hint">
          {text}
        </HintTooltip>
      </div>
    </div>
  );
}
