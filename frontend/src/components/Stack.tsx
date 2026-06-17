import type { ElementType, HTMLAttributes, ReactNode } from 'react';

/** Шаг отступа между дочерними элементами (токены --space-*). */
export type StackGap = 1 | 2 | 3 | 4 | 5 | 6;

export type StackDirection = 'row' | 'column';

export type StackAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';

export type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around';

const GAP_CLASS: Record<StackGap, string> = {
  1: 'stack--gap-1',
  2: 'stack--gap-2',
  3: 'stack--gap-3',
  4: 'stack--gap-4',
  5: 'stack--gap-5',
  6: 'stack--gap-6',
};

const ALIGN_CLASS: Record<StackAlign, string> = {
  start: 'stack--align-start',
  center: 'stack--align-center',
  end: 'stack--align-end',
  stretch: 'stack--align-stretch',
  baseline: 'stack--align-baseline',
};

const JUSTIFY_CLASS: Record<StackJustify, string> = {
  start: 'stack--justify-start',
  center: 'stack--justify-center',
  end: 'stack--justify-end',
  between: 'stack--justify-between',
  around: 'stack--justify-around',
};

export type StackProps<T extends ElementType = 'div'> = {
  as?: T;
  direction?: StackDirection;
  gap?: StackGap;
  align?: StackAlign;
  justify?: StackJustify;
  wrap?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, 'className'>;

/** Собирает классы layout-стека (для компонента и тестов). */
export function buildStackClassName(options: {
  direction?: StackDirection;
  gap?: StackGap;
  align?: StackAlign;
  justify?: StackJustify;
  wrap?: boolean;
  className?: string;
}): string {
  const {
    direction = 'column',
    gap = 3,
    align,
    justify,
    wrap,
    className,
  } = options;

  return [
    'stack',
    direction === 'row' ? 'stack--row' : undefined,
    GAP_CLASS[gap],
    align ? ALIGN_CLASS[align] : undefined,
    justify ? JUSTIFY_CLASS[justify] : undefined,
    wrap ? 'stack--wrap' : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Flex-контейнер с единым gap между дочерними элементами.
 * Предпочтительная замена ad-hoc `display:flex` + inline `gap` / `margin`.
 */
export function Stack<T extends ElementType = 'div'>({
  as,
  direction = 'column',
  gap = 3,
  align,
  justify,
  wrap,
  className,
  children,
  ...rest
}: StackProps<T>) {
  const Component = (as ?? 'div') as ElementType;
  const classes = buildStackClassName({ direction, gap, align, justify, wrap, className });

  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
