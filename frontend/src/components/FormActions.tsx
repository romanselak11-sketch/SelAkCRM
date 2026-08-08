import type { ReactNode } from 'react';

export type FormActionsProps = {
  children: ReactNode;
  flush?: boolean;
  className?: string;
};

/** Ряд кнопок формы (уже grid-column: 1 / -1 в CSS). */
export function FormActions({ children, flush, className }: FormActionsProps) {
  return (
    <div
      className={[
        'form-actions',
        flush ? 'form-actions--flush' : undefined,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

export function FormError({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  if (children == null || children === false || children === '') return null;
  return (
    <p className={['form-error', className].filter(Boolean).join(' ')} role="alert">
      {children}
    </p>
  );
}
