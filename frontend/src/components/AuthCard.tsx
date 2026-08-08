import type { ReactNode } from 'react';
import { Card } from './Card';

export type AuthCardProps = {
  brand: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Карточка Login / Setup. */
export function AuthCard({ brand, title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="auth-layout">
      <Card pad="lg" className="auth-card">
        <div className="page-titles auth-card-intro">
          <p className="auth-brand">{brand}</p>
          <h1 className="auth-heading">{title}</h1>
          <p className="page-sub">{subtitle}</p>
        </div>
        {children}
        {footer ?? null}
      </Card>
    </div>
  );
}
