import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker, type DateRange } from 'react-day-picker';
import { ru } from 'date-fns/locale/ru';
import 'react-day-picker/style.css';
import { parseLocalYMD, toLocalYMD } from '../utils/localDate';

export type AnalyticsPreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

type AnalyticsPeriodPickerProps = {
  from: string;
  to: string;
  preset: AnalyticsPreset;
  loading: boolean;
  onApply: (from: string, to: string, preset: AnalyticsPreset) => void;
  presetToday: () => { from: string; to: string };
  presetYesterday: () => { from: string; to: string };
  presetWeek: () => { from: string; to: string };
  presetMonth: () => { from: string; to: string };
  formatRangeLabel: (fromYmd: string, toYmd: string) => string;
};

export function AnalyticsPeriodPicker({
  from,
  to,
  preset,
  loading,
  onApply,
  presetToday,
  presetYesterday,
  presetWeek,
  presetMonth,
  formatRangeLabel,
}: AnalyticsPeriodPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(() => rangeFromStrings(from, to));
  const [month, setMonth] = useState<Date>(() => parseLocalYMD(from) ?? new Date());
  const [monthsShown, setMonthsShown] = useState(2);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const sync = () => setMonthsShown(mq.matches ? 1 : 2);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const panel = popoverRef.current;
    if (!trigger || !panel) return;

    const place = () => {
      const tr = triggerRef.current;
      const p = popoverRef.current;
      if (!tr || !p) return;
      const rect = tr.getBoundingClientRect();
      const margin = 8;
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
    const raf = requestAnimationFrame(place);
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
  }, [open, monthsShown]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  function applyPreset(
    p: Exclude<AnalyticsPreset, 'custom'>,
    getRange: () => { from: string; to: string },
  ) {
    const r = getRange();
    onApply(r.from, r.to, p);
    setOpen(false);
  }

  function handleApplyCustom() {
    if (!draft?.from || !draft.to) return;
    const a = toLocalYMD(draft.from);
    const b = toLocalYMD(draft.to);
    const [fromYmd, toYmd] = a <= b ? [a, b] : [b, a];
    onApply(fromYmd, toYmd, 'custom');
    setOpen(false);
  }

  const rangeComplete = Boolean(draft?.from && draft?.to);

  const popover =
    open && !loading ? (
      <div
        id={popoverId}
        ref={popoverRef}
        className="analytics-period-popover"
        role="dialog"
        aria-label="Выбор периода"
      >
        <div className="analytics-period-popover__presets" role="group" aria-label="Быстрый период">
          <button
            type="button"
            className={preset === 'yesterday' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyPreset('yesterday', presetYesterday)}
          >
            Вчера
          </button>
          <button
            type="button"
            className={preset === 'today' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyPreset('today', presetToday)}
          >
            Сегодня
          </button>
          <button
            type="button"
            className={preset === 'week' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyPreset('week', presetWeek)}
          >
            Неделя
          </button>
          <button
            type="button"
            className={preset === 'month' ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyPreset('month', presetMonth)}
          >
            Месяц
          </button>
        </div>

        <DayPicker
          mode="range"
          locale={ru}
          numberOfMonths={monthsShown}
          month={month}
          onMonthChange={setMonth}
          selected={draft}
          onSelect={setDraft}
          captionLayout="dropdown"
          startMonth={new Date(2000, 0)}
          endMonth={new Date(2040, 11)}
          className="date-field__daypicker analytics-period-popover__picker"
        />

        <div className="analytics-period-popover__footer">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen(false)}
          >
            Отмена
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={!rangeComplete}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleApplyCustom}
          >
            Применить
          </button>
        </div>
      </div>
    ) : null;

  return (
    <div className="analytics-period-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="analytics-period-picker__trigger"
        disabled={loading}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => {
          if (loading) return;
          setOpen((o) => {
            const next = !o;
            if (next) {
              setDraft(rangeFromStrings(from, to));
              setMonth(parseLocalYMD(from) ?? new Date());
            }
            return next;
          });
        }}
      >
        <span className="analytics-period-picker__label">Период</span>
        <span className="analytics-period-picker__value">{formatRangeLabel(from, to)}</span>
        <span className="date-field__icon" aria-hidden />
      </button>
      {popover ? createPortal(popover, document.body) : null}
    </div>
  );
}

function rangeFromStrings(a: string, b: string): DateRange | undefined {
  const fromD = parseLocalYMD(a);
  const toD = parseLocalYMD(b);
  if (!fromD || !toD) return undefined;
  return { from: fromD, to: toD };
}
