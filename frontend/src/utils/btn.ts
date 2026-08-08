/** Собирает классы единой кнопки дизайн-системы. */
export type BtnVariant = 'default' | 'primary' | 'ghost' | 'danger-soft';
export type BtnSize = 'md' | 'sm' | 'icon';

export function buildBtnClassName(options: {
  variant?: BtnVariant;
  size?: BtnSize;
  pill?: boolean;
  /** Выбранный сегмент (pill-tabs), не CTA primary */
  softActive?: boolean;
  className?: string;
} = {}): string {
  const { variant = 'default', size = 'md', pill, softActive, className } = options;

  const variantClass =
    variant === 'primary'
      ? 'btn--primary'
      : variant === 'ghost'
        ? 'btn--ghost'
        : variant === 'danger-soft'
          ? 'btn--danger-soft'
          : undefined;

  const sizeClass = size === 'sm' ? 'btn--sm' : size === 'icon' ? 'btn--icon' : undefined;

  return [
    'btn',
    variantClass,
    sizeClass,
    pill ? 'btn--pill' : undefined,
    softActive ? 'btn--soft-active' : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');
}
