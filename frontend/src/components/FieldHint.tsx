import type { ReactNode } from 'react';

type FieldHintProps = {
  children: ReactNode;
  id?: string;
};

export function FieldHint({ children, id }: FieldHintProps) {
  return (
    <span className="field-hint" id={id}>
      {children}
    </span>
  );
}
