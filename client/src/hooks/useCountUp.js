import { useEffect, useRef, useState } from 'react';

export default function useCountUp(target, { duration = 1600, start = false } = {}) {
  const [value, setValue] = useState(0);
  const valRef = useRef(0);

  useEffect(() => {
    if (!start) return;
    const from = valRef.current;
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + Math.max(target - from, 0) * eased);
      valRef.current = v;
      setValue(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else valRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, target, duration]);

  return value;
}
