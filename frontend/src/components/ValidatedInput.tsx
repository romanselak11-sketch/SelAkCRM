import type { InputHTMLAttributes } from 'react';
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
  ...rest
}: ValidatedInputProps) {
  const hintText = hint ?? FIELD_HINTS[kind];
  const hintId = rest.id ? `${rest.id}-hint` : undefined;
  const bubbleId = rest.id ? `${rest.id}-reject` : undefined;
  const numeric = kind === 'money' || kind === 'decimal';
  const rejectMessage = FIELD_REJECT_MESSAGES[kind];
  const { bubbleVisible, bubbleMessage, notifyRejected } = useInputRejectFeedback(rejectMessage);

  return (
    <div className="field-input-wrap">
      <FieldRejectBubble id={bubbleId} message={bubbleMessage} visible={bubbleVisible} />
      <input
        {...rest}
        id={rest.id}
        aria-describedby={
          [
            !hideHint && hintId ? hintId : null,
            bubbleVisible && bubbleId ? bubbleId : null,
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
      {!hideHint ? <FieldHint id={hintId}>{hintText}</FieldHint> : null}
    </div>
  );
}
