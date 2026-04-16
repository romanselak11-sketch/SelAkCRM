import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type Matcher, DayPicker } from 'react-day-picker';
import { ru } from 'date-fns/locale/ru';
import 'react-day-picker/style.css';
import { parseLocalYMD, toLocalYMD } from '../utils/localDate';

type DateFieldProps = {
  value: string;
  onChange: (ymd: string) => void;
  disabled?: boolean;
  /** YYYY-MM-DD, включительно */
  min?: string;
  /** YYYY-MM-DD, включительно */
  max?: string;
  /** Показать кнопку «Очистить» */
  allowClear?: boolean;
  placeholder?: string;
};

export function DateField({
  value,
  onChange,
  disabled,
  min,
  max,
  allowClear = false,
  placeholder = 'Выберите дату',
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(() => parseLocalYMD(value) ?? new Date());
  const popoverOpen = open && !disabled;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = parseLocalYMD(value);

  const disabledMatchers = useMemo((): Matcher[] | undefined => {
    const out: Matcher[] = [];
    const minD = min ? parseLocalYMD(min) : undefined;
    const maxD = max ? parseLocalYMD(max) : undefined;
    if (minD) out.push({ before: minD });
    if (maxD) out.push({ after: maxD });
    return out.length ? out : undefined;
  }, [min, max]);

  useLayoutEffect(() => {
    if (!popoverOpen) return;
    const trigger = triggerRef.current;
    const panel = popoverRef.current;
    if (!trigger || !panel) return;

    const place = () => {
      const tr = triggerRef.current;
      const p = popoverRef.current;
      if (!tr || !p) return;
      const rect = tr.getBoundingClientRect();
      const margin = 6;
      p.style.minWidth = `${Math.max(Math.ceil(rect.width), 280)}px`;
      const pw = p.offsetWidth;
      const ph = p.offsetHeight;
      let top = rect.bottom + margin;
      let left = rect.left;
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      if (top + ph > vh - margin) {
        top = Math.max(margin, rect.top - ph - margin);
      }
      if (left + pw > vw - margin) {
        left = Math.max(margin, vw - pw - margin);
      }
      if (left < margin) left = margin;
      p.style.top = `${top}px`;
      p.style.left = `${left}px`;
    };

    place();
    const raf = requestAnimationFrame(() => place());

    const ro = new ResizeObserver(place);
    ro.observe(trigger);
    ro.observe(panel);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [popoverOpen, month]);

  useEffect(() => {
    if (!popoverOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [popoverOpen]);

  useEffect(() => {
    if (!popoverOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [popoverOpen]);

  const labelText = selected
    ? selected.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const popover =
    popoverOpen ? (
      <div id={listId} ref={popoverRef} className="date-field__popover" role="dialog" aria-label="Календарь">
        <DayPicker
          mode="single"
          selected={selected}
          month={month}
          onMonthChange={setMonth}
          onSelect={(d) => {
            if (d) {
              onChange(toLocalYMD(d));
              setOpen(false);
            }
          }}
          locale={ru}
          captionLayout="dropdown"
          startMonth={new Date(2000, 0)}
          endMonth={new Date(2040, 11)}
          disabled={disabledMatchers}
          className="date-field__daypicker"
        />
        <div className="date-field__footer">
          {allowClear ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Очистить
            </button>
          ) : (
            <span className="date-field__footer-spacer" aria-hidden />
          )}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const t = new Date();
              onChange(toLocalYMD(t));
              setMonth(t);
              setOpen(false);
            }}
          >
            Сегодня
          </button>
        </div>
      </div>
    ) : null;

  return (
    <div className={`date-field${disabled ? ' date-field--disabled' : ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="date-field__trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={popoverOpen}
        aria-controls={popoverOpen ? listId : undefined}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => {
            const next = !o;
            if (next) setMonth(parseLocalYMD(value) ?? new Date());
            return next;
          });
        }}
      >
        <span className="date-field__trigger-text">
          {labelText ? (
            <span className="date-field__value">{labelText}</span>
          ) : (
            <span className="date-field__placeholder">{placeholder}</span>
          )}
        </span>
        <span className="date-field__icon" aria-hidden />
      </button>
      {popover ? createPortal(popover, document.body) : null}
    </div>
  );
}
