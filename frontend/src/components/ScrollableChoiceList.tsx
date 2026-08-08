import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ControlTrigger } from './ControlTrigger';

type ScrollableChoiceOption = { value: string; label: string };

const DEFAULT_VISIBLE_ROWS = 10;
/** Высота одной строки списка (rem), согласована с --control-height */
const ROW_HEIGHT_REM = 2.5;

type ScrollableChoiceListProps = {
  value: string;
  onChange: (value: string) => void;
  options: ScrollableChoiceOption[];
  placeholder: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptySearchText?: string;
  /** Показывать не больше стольких строк без прокрутки */
  visibleRows?: number;
  /** Пункт-заглушка, сбрасывающая значение в ''. По умолчанию true. */
  clearable?: boolean;
  'aria-label'?: string;
};

export function ScrollableChoiceList({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  searchable = false,
  searchPlaceholder = 'Поиск…',
  emptySearchText = 'Ничего не найдено',
  visibleRows = DEFAULT_VISIBLE_ROWS,
  clearable = true,
  'aria-label': ariaLabel,
}: ScrollableChoiceListProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const prevValueRef = useRef(value);
  const listId = useId();

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    return options.find((o) => o.value === value)?.label ?? '';
  }, [value, options]);

  const listOpen = open && !disabled;
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('ru-RU');

  const filteredOptions = useMemo(() => {
    if (!searchable || !normalizedQuery) return options;
    return options.filter((o) => o.label.toLocaleLowerCase('ru-RU').includes(normalizedQuery));
  }, [searchable, normalizedQuery, options]);

  useEffect(() => {
    if (!listOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
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

  useEffect(() => {
    if (listOpen) return;
    setSearchQuery('');
  }, [listOpen]);

  useEffect(() => {
    if (prevValueRef.current === value) return;
    prevValueRef.current = value;
    setOpen(false);
  }, [value]);

  useLayoutEffect(() => {
    if (!listOpen) return;
    const trigger = rootRef.current;
    const list = listRef.current;
    if (!trigger || !list) return;

    const place = () => {
      const root = rootRef.current;
      const panel = listRef.current;
      if (!root || !panel) return;
      const rect = root.getBoundingClientRect();
      const margin = 4;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const idealMax = visibleRows * ROW_HEIGHT_REM * 16; // rem≈16px fallback; clamp below via style
      const maxCap = Math.min(idealMax, vh * 0.45);

      panel.style.width = `${Math.ceil(rect.width)}px`;
      panel.style.maxHeight = `${maxCap}px`;

      const ph = panel.offsetHeight;
      let top = rect.bottom + margin;
      let left = rect.left;

      if (top + ph > vh - margin) {
        top = Math.max(margin, rect.top - ph - margin);
      }
      if (left + rect.width > vw - margin) {
        left = Math.max(margin, vw - rect.width - margin);
      }
      if (left < margin) left = margin;

      panel.style.top = `${top}px`;
      panel.style.left = `${left}px`;
    };

    place();
    const raf = requestAnimationFrame(() => place());
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    ro?.observe(trigger);
    ro?.observe(list);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [listOpen, filteredOptions.length, searchable, searchQuery, visibleRows]);

  const listMaxHeight = `min(${visibleRows * ROW_HEIGHT_REM}rem, 45vh)`;

  function pick(next: string) {
    onChange(next);
    setSearchQuery('');
    setOpen(false);
  }

  const list = listOpen ? (
    <ul
      ref={listRef}
      id={listId}
      className="scrollable-choice__list"
      role="listbox"
      style={{ maxHeight: listMaxHeight }}
    >
      {searchable ? (
        <li role="presentation" className="scrollable-choice__li scrollable-choice__li--search">
          <input
            type="text"
            className="scrollable-choice__search"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            autoComplete="off"
          />
        </li>
      ) : null}
      {clearable ? (
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
      ) : null}
      {filteredOptions.map((o) => (
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
      {searchable && filteredOptions.length === 0 ? (
        <li role="presentation" className="scrollable-choice__li">
          <p className="scrollable-choice__empty">{emptySearchText}</p>
        </li>
      ) : null}
    </ul>
  ) : null;

  return (
    <div className={`scrollable-choice${disabled ? ' scrollable-choice--disabled' : ''}`} ref={rootRef}>
      <ControlTrigger
        block
        className="scrollable-choice__trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={listOpen}
        aria-controls={listOpen ? listId : undefined}
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
        trailing={<span className="scrollable-choice__chevron" aria-hidden />}
      >
        <span className="scrollable-choice__trigger-text">
          {selectedLabel ? (
            <span className="scrollable-choice__value">{selectedLabel}</span>
          ) : (
            <span className="scrollable-choice__placeholder">{placeholder}</span>
          )}
        </span>
      </ControlTrigger>
      {typeof document !== 'undefined' && list ? createPortal(list, document.body) : null}
    </div>
  );
}
