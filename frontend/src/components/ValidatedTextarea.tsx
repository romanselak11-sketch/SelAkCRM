import type { TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import { sanitizeText } from '../utils/fieldInput';

type ValidatedTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
};

export function ValidatedTextarea({ value, onChange, id, ...rest }: ValidatedTextareaProps) {
  const autoId = useId();
  const areaId = id ?? autoId;

  return (
    <textarea
      {...rest}
      id={areaId}
      value={value}
      onChange={(e) => onChange(sanitizeText(e.target.value))}
    />
  );
}
