import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { shouldShowFloatingHorizontalScroll } from './horizontal-scroll-visibility';

type HorizontalScrollWrapProps = {
  children: ReactNode;
  className?: string;
};

type TrackMetrics = {
  left: number;
  width: number;
  contentWidth: number;
  visible: boolean;
};

/**
 * Горизонтальный скролл широкой таблицы: полоса фиксируется у нижнего края окна,
 * пока нативный скролл таблицы не попал в зону видимости.
 */
export function HorizontalScrollWrap({ children, className }: HorizontalScrollWrapProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<TrackMetrics>({
    left: 0,
    width: 0,
    contentWidth: 0,
    visible: false,
  });
  const syncingRef = useRef<'viewport' | 'track' | null>(null);

  const updateMetrics = useCallback(() => {
    const viewport = viewportRef.current;
    const root = rootRef.current;
    if (!viewport || !root) return;

    const rootRect = root.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const overflow = viewport.scrollWidth > viewport.clientWidth + 1;
    const showFixed = shouldShowFloatingHorizontalScroll(
      viewportRect,
      window.innerHeight,
      overflow,
    );

    setMetrics({
      left: rootRect.left,
      width: rootRect.width,
      contentWidth: viewport.scrollWidth,
      visible: showFixed,
    });
  }, []);

  useEffect(() => {
    updateMetrics();
    const viewport = viewportRef.current;
    const ro = new ResizeObserver(updateMetrics);
    if (viewport) {
      ro.observe(viewport);
      if (viewport.firstElementChild) {
        ro.observe(viewport.firstElementChild);
      }
    }
    window.addEventListener('scroll', updateMetrics, { passive: true, capture: true });
    window.addEventListener('resize', updateMetrics);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', updateMetrics, true);
      window.removeEventListener('resize', updateMetrics);
    };
  }, [updateMetrics, children]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || !metrics.visible) return;

    const onViewportScroll = () => {
      if (syncingRef.current === 'track') return;
      syncingRef.current = 'viewport';
      track.scrollLeft = viewport.scrollLeft;
      syncingRef.current = null;
    };

    const onTrackScroll = () => {
      if (syncingRef.current === 'viewport') return;
      syncingRef.current = 'track';
      viewport.scrollLeft = track.scrollLeft;
      syncingRef.current = null;
    };

    viewport.addEventListener('scroll', onViewportScroll, { passive: true });
    track.addEventListener('scroll', onTrackScroll, { passive: true });
    return () => {
      viewport.removeEventListener('scroll', onViewportScroll);
      track.removeEventListener('scroll', onTrackScroll);
    };
  }, [metrics.visible]);

  const wrapClass = ['data-table-hscroll', className].filter(Boolean).join(' ');

  return (
    <div ref={rootRef} className={wrapClass}>
      <div
        ref={viewportRef}
        className={[
          'data-table-hscroll__viewport',
          metrics.visible ? 'data-table-hscroll__viewport--floating-active' : undefined,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>
      {metrics.visible ? (
        <div
          ref={trackRef}
          className="data-table-hscroll__track--fixed"
          style={{ left: metrics.left, width: metrics.width }}
          aria-hidden="true"
          tabIndex={-1}
        >
          <div className="data-table-hscroll__track-inner" style={{ width: metrics.contentWidth }} />
        </div>
      ) : null}
    </div>
  );
}
