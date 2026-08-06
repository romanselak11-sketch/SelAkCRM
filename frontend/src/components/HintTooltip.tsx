import { useId, type ReactNode } from 'react';

export type HintTooltipProps = {
  children: ReactNode;
  /** Связь с aria-describedby у контрола */
  id?: string;
  /** Подпись кнопки для скринридеров */
  ariaLabel?: string;
  className?: string;
};

/** Значок «?» с текстом подсказки при наведении / фокусе. */
export function HintTooltip({
  children,
  id,
  ariaLabel = 'Подсказка',
  className,
}: HintTooltipProps) {
  const generatedId = useId();
  const tipId = id ?? generatedId;

  return (
    <span className={['hint-tip', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className="hint-tip__btn"
        aria-describedby={tipId}
        aria-label={ariaLabel}
        onClick={(e) => {
          // Не активируем родительский <label> / не уводим фокус с поля.
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        ?
      </button>
      <span id={tipId} className="hint-tip__tooltip" role="tooltip">
        {children}
      </span>
    </span>
  );
}
