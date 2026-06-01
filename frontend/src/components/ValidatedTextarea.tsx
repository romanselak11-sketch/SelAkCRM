import type { TextareaHTMLAttributes } from 'react';
import { FieldHint } from './FieldHint';
import { FIELD_HINTS, sanitizeText } from '../utils/fieldInput';

type ValidatedTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  hideHint?: boolean;
};

export function ValidatedTextarea({
  value,
  onChange,
  hint,
  hideHint,
  ...rest
}: ValidatedTextareaProps) {
  const hintText = hint ?? FIELD_HINTS.text;
  const hintId = rest.id ? `${rest.id}-hint` : undefined;

  return (
    <div className="field-input-wrap">
      <textarea
        {...rest}
        id={rest.id}
        aria-describedby={!hideHint && hintId ? hintId : rest['aria-describedby']}
        value={value}
        onChange={(e) => onChange(sanitizeText(e.target.value))}
      />
      {!hideHint ? <FieldHint id={hintId}>{hintText}</FieldHint> : null}
    </div>
  );
}
