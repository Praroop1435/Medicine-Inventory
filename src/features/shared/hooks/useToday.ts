import { useEffect, useState } from 'react';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Local midnight of today; re-renders when the next local midnight passes. */
export function useToday(): Date {
  const [today, setToday] = useState(() => startOfDay(new Date()));
  useEffect(() => {
    const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const t = setTimeout(() => setToday(startOfDay(new Date())), next.getTime() - Date.now());
    return () => clearTimeout(t);
  }, [today]);
  return today;
}
