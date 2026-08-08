import type { HTMLAttributes, ReactNode } from 'react';

type EmptyHintVariant = 'default' | 'inCell' | 'inCard' | 'panel' | 'chart';

const VARIANT_CLASS: Record<EmptyHintVariant, string> = {
  default: 'empty-hint',
  inCell: 'empty-hint empty-hint--in-cell',
  inCard: 'empty-hint empty-hint--in-card',
  panel: 'empty-hint empty-hint--panel',
  chart: 'empty-hint empty-hint--chart',
};

export type EmptyHintProps = {
  variant?: EmptyHintVariant;
  children: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLParagraphElement>, 'className' | 'children'>;

/** Пустое / загрузочное состояние (ячейка, карточка, панель, график). */
export function EmptyHint({
  variant = 'default',
  children,
  className,
  ...rest
}: EmptyHintProps) {
  return (
    <p className={[VARIANT_CLASS[variant], className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </p>
  );
}
