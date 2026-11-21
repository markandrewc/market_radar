import { useCallback, useEffect, useState } from 'react';

export function usePageTitle(title: string) {
  useEffect(() => { document.title = `${title} · Market Radar`; }, [title]);
}

/** A true/false flag remembered in the browser. Works even if storage is blocked. */
export function useLocalFlag(key: string): [boolean, (v: boolean) => void] {
  const read = () => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
  const [value, setValue] = useState(read);
  const set = useCallback((v: boolean) => {
    setValue(v);
    try { localStorage.setItem(key, v ? '1' : '0'); } catch { /* storage blocked: the flag lasts for this visit only */ }
  }, [key]);
  return [value, set];
}

export function usePaged<T>(items: T[], size: number) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const safe = Math.min(page, pageCount);
  return { page: safe, setPage, pageCount, slice: items.slice((safe - 1) * size, safe * size), total: items.length };
}
