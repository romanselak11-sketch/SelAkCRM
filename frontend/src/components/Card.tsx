import type { HTMLAttributes, ReactNode } from 'react';

export type CardProps = {
  pad?: 'default' | 'lg';
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'>;

export function Card({ pad = 'default', className, children, ...rest }: CardProps) {
  return (
    <section
      className={['card', pad === 'lg' ? 'card--pad-lg' : undefined, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </section>
  );
}

export type CardHeaderProps = {
  title: ReactNode;
  actions?: ReactNode;
  tight?: boolean;
  className?: string;
};

export function CardHeader({ title, actions, tight, className }: CardHeaderProps) {
  return (
    <div
      className={['card-header', tight ? 'card-header--tight' : undefined, className]
        .filter(Boolean)
        .join(' ')}
    >
      <h2 className="card-title">{title}</h2>
      {actions ?? null}
    </div>
  );
}

export function CardTitle({
  children,
  className,
  as: Tag = 'h2',
}: {
  children: ReactNode;
  className?: string;
  as?: 'h2' | 'h3';
}) {
  return <Tag className={['card-title', className].filter(Boolean).join(' ')}>{children}</Tag>;
}
