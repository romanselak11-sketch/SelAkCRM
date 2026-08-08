import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type Matcher, DayPicker } from 'react-day-picker';
import { ru } from 'date-fns/locale/ru';
import 'react-day-picker/style.css';
import {
  formatLocalDateRuLong,
  isLocalDateWithinBounds,
  localYmdToDotted,
  parseManualDateInput,
  parseLocalYMD,
  sanitizeManualDateInput,
  toLocalYMD,
} from '../utils/localDate';
import { FieldRejectBubble } from './FieldRejectBubble';
import { Btn } from './Btn';

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
  id?: string;
};

const REJECT_CHARS =
  'Допустимы цифры, точка и запятая. Форматы: ДД.ММ.ГГГГ, ДДММГГГГ, ДД,ММ,ГГГГ';
const REJECT_SHOW_MS = 2400;
const REJECT_THROTTLE_MS = 700;

export function DateField({
  value,
  onChange,
  disabled,
  min,
  max,
  allowClear = false,
  placeholder = 'Выберите дату',
  id: idProp,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const [month, setMonth] = useState<Date>(() => parseLocalYMD(value) ?? new Date());
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectMessage, setRejectMessage] = useState('');
  const popoverOpen = open && !disabled;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const autoId = useId();
  const fieldId = idProp ?? autoId;
  const rejectId = `${fieldId}-reject`;
  const hideRejectTimerRef = useRef<number | null>(null);
  const lastRejectRef = useRef(0);
  const selectAllOnFocusRef = useRef(false);

  const selected = parseLocalYMD(value);

  const showReject = useCallback((message: string) => {
    const now = Date.now();
    if (now - lastRejectRef.current < REJECT_THROTTLE_MS) return;
    lastRejectRef.current = now;
    setRejectMessage(message);
    setRejectVisible(true);
    if (hideRejectTimerRef.current !== null) window.clearTimeout(hideRejectTimerRef.current);
    hideRejectTimerRef.current = window.setTimeout(() => {
      hideRejectTimerRef.current = null;
      setRejectVisible(false);
    }, REJECT_SHOW_MS);
  }, []);

  useEffect(
    () => () => {
      if (hideRejectTimerRef.current !== null) window.clearTimeout(hideRejectTimerRef.current);
    },
    [],
  );

  const disabledMatchers = useMemo((): Matcher[] | undefined => {
    const out: Matcher[] = [];
    const minD = min ? parseLocalYMD(min) : undefined;
    const maxD = max ? parseLocalYMD(max) : undefined;
    if (minD) out.push({ before: minD });
    if (maxD) out.push({ after: maxD });
    return out.length ? out : undefined;
  }, [min, max]);

  const commitDraft = useCallback((): boolean => {
    const trimmed = draft.trim();
    if (!trimmed) {
      if (allowClear) onChange('');
      return true;
    }

    const parsed = parseManualDateInput(trimmed);
    if (!parsed) {
      setDraft(selected ? localYmdToDotted(value) : '');
      return false;
    }
    if (!isLocalDateWithinBounds(parsed, min, max)) {
      setDraft(selected ? localYmdToDotted(value) : '');
      return false;
    }

    onChange(toLocalYMD(parsed));
    setMonth(parsed);
    return true;
  }, [allowClear, draft, max, min, onChange, selected, value]);

  useLayoutEffect(() => {
    if (!selectAllOnFocusRef.current || !focused) return;
    selectAllOnFocusRef.current = false;
    const el = inputRef.current;
    if (!el) return;
    el.setSelectionRange(0, el.value.length);
  }, [focused, draft]);

  useLayoutEffect(() => {
    if (!popoverOpen) return;
    const trigger = inputRef.current;
    const panel = popoverRef.current;
    if (!trigger || !panel) return;

    const place = () => {
      const tr = inputRef.current;
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

  const displayValue = focused
    ? draft
    : selected
      ? formatLocalDateRuLong(selected)
      : '';

  const openCalendar = () => {
    if (disabled) return;
    setOpen((o) => {
      const next = !o;
      if (next) setMonth(parseLocalYMD(value) ?? new Date());
      return next;
    });
  };

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
              setMonth(d);
              setOpen(false);
              setFocused(false);
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
            <Btn
              variant="ghost"
              size="sm"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange('');
                setDraft('');
                setOpen(false);
                setFocused(false);
              }}
            >
              Очистить
            </Btn>
          ) : (
            <span className="date-field__footer-spacer" aria-hidden />
          )}
          <Btn
            variant="ghost"
            size="sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const t = new Date();
              onChange(toLocalYMD(t));
              setMonth(t);
              setOpen(false);
              setFocused(false);
            }}
          >
            Сегодня
          </Btn>
        </div>
      </div>
    ) : null;

  return (
    <div className={`date-field${disabled ? ' date-field--disabled' : ''}`} ref={rootRef}>
      <div className="field-input-wrap">
        <FieldRejectBubble id={rejectId} message={rejectMessage} visible={rejectVisible} />
        <div className="date-field__control">
          <input
            ref={inputRef}
            id={fieldId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            className={[
              'date-field__input',
              !focused && selected ? 'date-field__input--filled' : null,
              !focused && !selected ? 'date-field__input--placeholder' : null,
            ]
              .filter(Boolean)
              .join(' ')}
            value={displayValue}
            placeholder={placeholder}
            aria-haspopup="dialog"
            aria-expanded={popoverOpen}
            aria-controls={popoverOpen ? listId : undefined}
            aria-describedby={rejectVisible ? rejectId : undefined}
            aria-invalid={rejectVisible || undefined}
            onFocus={() => {
              if (disabled) return;
              setFocused(true);
              setDraft(selected ? localYmdToDotted(value) : '');
              setRejectVisible(false);
              selectAllOnFocusRef.current = true;
            }}
            onChange={(e) => {
              const next = sanitizeManualDateInput(e.target.value);
              if (next !== e.target.value) showReject(REJECT_CHARS);
              setDraft(next);
            }}
            onBlur={() => {
              if (popoverOpen) return;
              commitDraft();
              setFocused(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (commitDraft()) {
                  inputRef.current?.blur();
                  setFocused(false);
                }
              }
              if (e.key === 'ArrowDown' && !popoverOpen) {
                e.preventDefault();
                openCalendar();
              }
            }}
          />
          <Btn
            variant="ghost"
            size="icon"
            className="btn--input-affix"
            disabled={disabled}
            tabIndex={-1}
            aria-label="Открыть календарь"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openCalendar}
          >
            <span className="date-field__icon" aria-hidden />
          </Btn>
        </div>
      </div>
      {popover ? createPortal(popover, document.body) : null}
    </div>
  );
}
