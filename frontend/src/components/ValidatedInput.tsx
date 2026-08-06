import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import { useInputRejectFeedback } from '../hooks/useInputRejectFeedback';
import {
  FIELD_HINTS,
  FIELD_REJECT_MESSAGES,
  applyFieldInput,
  type FieldInputKind,
  fieldInputMode,
} from '../utils/fieldInput';
import { FieldHint } from './FieldHint';
import { FieldRejectBubble } from './FieldRejectBubble';

type ValidatedInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  kind: FieldInputKind;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  hideHint?: boolean;
};

export function ValidatedInput({
  kind,
  value,
  onChange,
  hint,
  hideHint,
  inputMode,
  className,
  id,
  ...rest
}: ValidatedInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintText = hint ?? FIELD_HINTS[kind];
  const hintId = `${inputId}-hint`;
  const bubbleId = `${inputId}-reject`;
  const numeric = kind === 'money' || kind === 'decimal';
  const rejectMessage = FIELD_REJECT_MESSAGES[kind];
  const { bubbleVisible, bubbleMessage, notifyRejected } = useInputRejectFeedback(rejectMessage);
  const showHint = !hideHint && Boolean(hintText);

  return (
    <div className="field-input-wrap">
      <FieldRejectBubble id={bubbleId} message={bubbleMessage} visible={bubbleVisible} />
      <div className="field-input-wrap__row">
        <input
          {...rest}
          id={inputId}
          aria-describedby={
            [
              showHint ? hintId : null,
              bubbleVisible ? bubbleId : null,
              rest['aria-describedby'] ?? null,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          value={value}
          inputMode={inputMode ?? fieldInputMode(kind)}
          className={[numeric ? 'input-numeric-no-spin' : null, className].filter(Boolean).join(' ') || undefined}
          onChange={(e) => {
            const { value: next, rejected } = applyFieldInput(kind, e.target.value);
            if (rejected) notifyRejected();
            onChange(next);
          }}
        />
        {showHint ? <FieldHint id={hintId}>{hintText}</FieldHint> : null}
      </div>
    </div>
  );
}
