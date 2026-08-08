import type { InputHTMLAttributes } from 'react';

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> & {
  label: string;
  /** Скрыть видимый текст (остаётся для AT через label) */
  hideLabel?: boolean;
};

/** Переключатель on/off (Swiss Brutalism: без pill 999px, без теней). */
export function Switch({
  id,
  label,
  hideLabel = false,
  className,
  checked,
  disabled,
  onChange,
  ...rest
}: SwitchProps) {
  const inputId = id ?? `switch-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <label
      className={['switch', disabled ? 'switch--disabled' : undefined, className]
        .filter(Boolean)
        .join(' ')}
      htmlFor={inputId}
    >
      <input
        {...rest}
        id={inputId}
        type="checkbox"
        role="switch"
        className="switch__input"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-checked={checked}
      />
      <span className="switch__track" aria-hidden>
        <span className="switch__thumb" />
      </span>
      <span className={hideLabel ? 'visually-hidden' : 'switch__label'}>{label}</span>
    </label>
  );
}
