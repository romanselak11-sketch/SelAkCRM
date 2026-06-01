import { useCallback, useEffect, useRef, useState } from 'react';

const SHOW_MS = 2400;
const THROTTLE_MS = 700;

/** Эфемерная подсказка при отклонённом символе (не чаще раза в THROTTLE_MS). */
export function useInputRejectFeedback(message: string | null) {
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const lastShownRef = useRef(0);

  const notifyRejected = useCallback(() => {
    if (!message) return;
    const now = Date.now();
    if (now - lastShownRef.current < THROTTLE_MS) return;
    lastShownRef.current = now;
    setVisible(true);
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      setVisible(false);
    }, SHOW_MS);
  }, [message]);

  useEffect(
    () => () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    },
    [],
  );

  return { bubbleVisible: visible && Boolean(message), bubbleMessage: message ?? '', notifyRejected };
}
