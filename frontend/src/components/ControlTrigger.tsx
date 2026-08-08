import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { buildControlTriggerClassName } from '../utils/controlTrigger';

export type ControlTriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  block?: boolean;
  inline?: boolean;
  soft?: boolean;
  className?: string;
  trailing?: ReactNode;
  children: ReactNode;
};

/** Кнопка-триггер выпадающего списка / периода (единый chrome). */
export const ControlTrigger = forwardRef<HTMLButtonElement, ControlTriggerProps>(
  function ControlTrigger(
    { block, inline, soft, className, trailing, children, type = 'button', ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={buildControlTriggerClassName({ block, inline, soft, className })}
        {...rest}
      >
        {children}
        {trailing ?? null}
      </button>
    );
  },
);
