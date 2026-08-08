import type { ReactNode } from 'react';
import { FieldHint } from './FieldHint';

type FieldLabelProps = {
  children: ReactNode;
  /** Текст подсказки «?» рядом с названием поля */
  hint?: ReactNode;
  hintId?: string;
};

/** Подпись поля формы; подсказка всегда у названия, не у контрола. */
export function FieldLabel({ children, hint, hintId }: FieldLabelProps) {
  return (
    <span className="field-label">
      {children}
      {hint != null && hint !== '' ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
    </span>
  );
}
