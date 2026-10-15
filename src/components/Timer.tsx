import { useEffect, useRef, useState } from "react";
import { remainingMs } from "../lib/clock";
import { every } from "../lib/ticker";
import { fmtDuration } from "../lib/format";

/** Har 250 ms da server vaqtiga nisbatan qolgan vaqtni hisoblaydi (sekund ayirib bormaydi). */
export default function Timer({ deadline, onExpire }: { deadline: string; onExpire: () => void }) {
  const [ms, setMs] = useState(() => remainingMs(deadline));
  const fired = useRef(false);
  const cb = useRef(onExpire);
  cb.current = onExpire;

  useEffect(() => {
    fired.current = false;
    const tick = () => {
      const r = remainingMs(deadline);
      setMs(r);
      if (r <= 0 && !fired.current) { fired.current = true; cb.current(); }
    };
    tick();
    return every(250, tick); // fon rejimida ham vaqt tugashi o'z vaqtida ishlaydi
  }, [deadline]);

  const sec = Math.ceil(ms / 1000);
  const danger = sec <= 10;
  return (
    <div className={`flex h-10 items-center rounded-full px-4 font-mono text-[15px] font-medium tabular-nums ${danger ? "animate-pulse bg-blush text-danger" : "bg-surface-100 text-ink"}`}>
      {fmtDuration(sec)}
    </div>
  );
}
