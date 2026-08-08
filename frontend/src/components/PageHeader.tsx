import type { ReactNode } from 'react';
import { PageHeading } from './PageHeading';

export type PageHeaderProps = {
  title: string;
  hint?: string;
  actions?: ReactNode;
};

/** Заголовок страницы + опциональные действия справа. */
export function PageHeader({ title, hint, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <PageHeading title={title} hint={hint} />
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}
