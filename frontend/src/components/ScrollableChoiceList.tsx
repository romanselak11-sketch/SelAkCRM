import { useEffect, useId, useMemo, useRef, useState } from 'react';

export type ScrollableChoiceOption = { value: string; label: string };

const DEFAULT_VISIBLE_ROWS = 10;
/** Высота одной строки списка (rem), согласована с .scrollable-choice__option */
const ROW_HEIGHT_REM = 2.375;

type ScrollableChoiceListProps = {
  value: string;
  onChange: (value: string) => void;
  options: ScrollableChoiceOption[];
  placeholder: string;
  disabled?: boolean;
  /** Показывать не больше стольких строк без прокрутки */
  visibleRows?: number;
};

export function ScrollableChoiceList({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  visibleRows = DEFAULT_VISIBLE_ROWS,
}: ScrollableChoiceListProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    return options.find((o) => o.value === value)?.label ?? '';
  }, [value, options]);

  const listOpen = open && !disabled;

  useEffect(() => {
    if (!listOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [listOpen]);

  useEffect(() => {
    if (!listOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [listOpen]);

  const listMaxHeight = `min(${visibleRows * ROW_HEIGHT_REM}rem, 45vh)`;

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div className={`scrollable-choice${disabled ? ' scrollable-choice--disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="scrollable-choice__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={listOpen}
        aria-controls={listOpen ? listId : undefined}
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
      >
        <span className="scrollable-choice__trigger-text">
          {selectedLabel ? (
            <span className="scrollable-choice__value">{selectedLabel}</span>
          ) : (
            <span className="scrollable-choice__placeholder">{placeholder}</span>
          )}
        </span>
        <span className="scrollable-choice__chevron" aria-hidden />
      </button>
      {listOpen ? (
        <ul
          id={listId}
          className="scrollable-choice__list"
          role="listbox"
          style={{ maxHeight: listMaxHeight }}
        >
          <li role="presentation" className="scrollable-choice__li">
            <button
              type="button"
              role="option"
              className={`scrollable-choice__option${value === '' ? ' scrollable-choice__option--active' : ''}`}
              aria-selected={value === ''}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick('')}
            >
              {placeholder}
            </button>
          </li>
          {options.map((o) => (
            <li key={o.value} role="presentation" className="scrollable-choice__li">
              <button
                type="button"
                role="option"
                className={`scrollable-choice__option${value === o.value ? ' scrollable-choice__option--active' : ''}`}
                aria-selected={value === o.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o.value)}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
