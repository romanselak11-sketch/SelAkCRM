import type { ElementType, HTMLAttributes, ReactNode } from 'react';

export type SurfacePanelProps = {
  pad?: boolean;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, 'className' | 'children'>;

/** Поверхность/панель: KPI, тулбары, компактные блоки. */
export function SurfacePanel({
  pad = false,
  as: Tag = 'div',
  className,
  children,
  ...rest
}: SurfacePanelProps) {
  return (
    <Tag
      className={['surface-panel', pad ? 'surface-panel--pad' : undefined, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export type LabelCapsProps = {
  children: ReactNode;
  className?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, 'className' | 'children'>;

/** Мелкая подпись над контролом (фильтры, KPI). */
export function LabelCaps({ children, className, ...rest }: LabelCapsProps) {
  return (
    <span className={['label-caps', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </span>
  );
}
