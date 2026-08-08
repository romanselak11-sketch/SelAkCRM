import type { HTMLAttributes, LiHTMLAttributes, ReactNode } from 'react';

export type EntityListProps = {
  spaced?: boolean;
  children: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLUListElement>, 'className' | 'children'>;

export function EntityList({ spaced, className, children, ...rest }: EntityListProps) {
  return (
    <ul
      className={['entity-list', spaced ? 'entity-list--spaced' : undefined, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </ul>
  );
}

export type EntityListItemProps = {
  active?: boolean;
  children: ReactNode;
  className?: string;
} & Omit<LiHTMLAttributes<HTMLLIElement>, 'className' | 'children'>;

export function EntityListItem({ active, className, children, ...rest }: EntityListItemProps) {
  return (
    <li
      className={[
        'entity-list__item',
        active ? 'entity-list__item--active' : undefined,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </li>
  );
}

export function EntityListMeta({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={['entity-list__meta', className].filter(Boolean).join(' ')}>{children}</span>;
}
