import { forwardRef, type ButtonHTMLAttributes } from 'react';
import {
  buildBtnClassName,
  type BtnSize,
  type BtnVariant,
} from '../utils/btn';

export type BtnProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  variant?: BtnVariant;
  size?: BtnSize;
  pill?: boolean;
  /** Выбранный сегмент (табы / пресеты), не CTA */
  softActive?: boolean;
  className?: string;
};

/**
 * Единая кнопка дизайн-системы.
 * Варианты: default | primary | ghost | danger-soft
 * Размеры: md | sm | icon
 */
export const Btn = forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  {
    variant = 'default',
    size = 'md',
    pill = false,
    softActive = false,
    className,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buildBtnClassName({ variant, size, pill, softActive, className })}
      {...rest}
    />
  );
});
