import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import { useInputRejectFeedback } from '../hooks/useInputRejectFeedback';
import {
  FIELD_REJECT_MESSAGES,
  applyFieldInput,
  type FieldInputKind,
  fieldInputMode,
} from '../utils/fieldInput';
import { selectInputText } from '../utils/selectInputText';
import { FieldRejectBubble } from './FieldRejectBubble';

type ValidatedInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  kind: FieldInputKind;
  value: string;
  onChange: (value: string) => void;
};

export function ValidatedInput({
  kind,
  value,
  onChange,
  inputMode,
  className,
  id,
  onFocus,
  onClick,
  ...rest
}: ValidatedInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const bubbleId = `${inputId}-reject`;
  const numeric = kind === 'money' || kind === 'decimal';
  const rejectMessage = FIELD_REJECT_MESSAGES[kind];
  const { bubbleVisible, bubbleMessage, notifyRejected } = useInputRejectFeedback(rejectMessage);

  return (
    <div className="field-input-wrap">
      <FieldRejectBubble id={bubbleId} message={bubbleMessage} visible={bubbleVisible} />
      <input
        {...rest}
        id={inputId}
        aria-describedby={
          [bubbleVisible ? bubbleId : null, rest['aria-describedby'] ?? null].filter(Boolean).join(' ') ||
          undefined
        }
        value={value}
        inputMode={inputMode ?? fieldInputMode(kind)}
        className={[numeric ? 'input-numeric-no-spin' : null, className].filter(Boolean).join(' ') || undefined}
        onFocus={(e) => {
          onFocus?.(e);
          if (numeric) selectInputText(e.currentTarget);
        }}
        onClick={(e) => {
          onClick?.(e);
          if (numeric) selectInputText(e.currentTarget);
        }}
        onChange={(e) => {
          const { value: next, rejected } = applyFieldInput(kind, e.target.value);
          if (rejected) notifyRejected();
          onChange(next);
        }}
      />
    </div>
  );
}
