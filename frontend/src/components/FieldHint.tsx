import type { ReactNode } from 'react';
import { HintTooltip } from './HintTooltip';

type FieldHintProps = {
  children: ReactNode;
  id?: string;
  ariaLabel?: string;
};

/** Подсказка к полю формы: иконка «?», текст при наведении. */
export function FieldHint({ children, id, ariaLabel = 'Подсказка к полю' }: FieldHintProps) {
  return (
    <HintTooltip id={id} ariaLabel={ariaLabel} className="field-hint">
      {children}
    </HintTooltip>
  );
}
