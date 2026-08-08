import type { ReactNode } from 'react';

export function LoadingScreen({ children = 'Загрузка…' }: { children?: ReactNode }) {
  return <p className="loading-screen">{children}</p>;
}
