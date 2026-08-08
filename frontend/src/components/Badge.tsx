import type { ReactNode } from 'react';

export type BadgeProps = {
  variant?: 'default' | 'accent';
  children: ReactNode;
  className?: string;
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={[
        'badge',
        variant === 'accent' ? 'badge--accent' : undefined,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
