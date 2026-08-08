import type { ReactNode } from 'react';

export type ListToolbarProps = {
  children: ReactNode;
  className?: string;
};

/** Панель поиска/фильтров над таблицей. */
export function ListToolbar({ children, className }: ListToolbarProps) {
  return (
    <div className={['list-toolbar', className].filter(Boolean).join(' ')}>{children}</div>
  );
}

export type ListSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  'aria-label': string;
};

export function ListSearchInput({
  value,
  onChange,
  placeholder,
  'aria-label': ariaLabel,
}: ListSearchInputProps) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  );
}
