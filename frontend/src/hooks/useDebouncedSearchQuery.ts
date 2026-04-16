import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Поле ввода + строка запроса с debounce; при смене запроса вызывает setPage(1), кроме первой инициализации.
 */
export function useDebouncedSearchQuery(setPage: Dispatch<SetStateAction<number>>) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const prevCommitted = useRef('');
  const didInit = useRef(false);

  useEffect(() => {
    const delay = searchInput.trim() === '' ? 0 : 300;
    const id = setTimeout(() => {
      const v = searchInput.trim();
      if (!didInit.current) {
        didInit.current = true;
        prevCommitted.current = v;
        setDebouncedQ(v);
        return;
      }
      if (v !== prevCommitted.current) {
        prevCommitted.current = v;
        setDebouncedQ(v);
        setPage(1);
      }
    }, delay);
    return () => clearTimeout(id);
  }, [searchInput, setPage]);

  return { searchInput, setSearchInput, debouncedQ };
}
