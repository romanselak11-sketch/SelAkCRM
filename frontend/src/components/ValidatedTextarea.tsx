import type { TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import { FIELD_HINTS, sanitizeText } from '../utils/fieldInput';
import { FieldHint } from './FieldHint';

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
  id,
  ...rest
}: ValidatedTextareaProps) {
  const autoId = useId();
  const areaId = id ?? autoId;
  const hintText = hint ?? FIELD_HINTS.text;
  const hintId = `${areaId}-hint`;
  const showHint = !hideHint && Boolean(hintText);

  return (
    <div className="field-input-wrap">
      <div className="field-input-wrap__row field-input-wrap__row--textarea">
        <textarea
          {...rest}
          id={areaId}
          aria-describedby={
            showHint
              ? [hintId, rest['aria-describedby']].filter(Boolean).join(' ')
              : rest['aria-describedby']
          }
          value={value}
          onChange={(e) => onChange(sanitizeText(e.target.value))}
        />
        {showHint ? <FieldHint id={hintId}>{hintText}</FieldHint> : null}
      </div>
    </div>
  );
}
