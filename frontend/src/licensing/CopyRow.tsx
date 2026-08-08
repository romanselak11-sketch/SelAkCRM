import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Btn } from '../components/Btn';
import { FieldLabel } from '../components/FieldLabel';

type CopyRowProps = {
  label: ReactNode;
  value: string;
  hint?: ReactNode;
  /** Подпись под строкой: что с этим значением делать. */
  description?: ReactNode;
};

/** Значение и кнопка копирования в одну строку. */
export function CopyRow({ label, value, hint, description }: CopyRowProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="stack stack--gap-2">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <div className="copy-row">
        <code className="mono copy-row__value" title={value}>
          {value}
        </code>
        <Btn size="sm" variant="ghost" disabled={!value} onClick={() => void copy()}>
          {copied ? 'Скопировано' : 'Копировать'}
        </Btn>
      </div>
      {description ? <p className="field-note">{description}</p> : null}
      <span aria-live="polite" className="visually-hidden">
        {copied ? 'Скопировано в буфер обмена' : ''}
      </span>
    </div>
  );
}
