import { create } from "zustand";
import type { EventType } from "../api/types";

/** Real-time ko'rsatkichlar: o'quvchi ekranidagi indikator va lokal ogohlantirish uchun. */
interface LiveSignals {
  faces: number | null; // null — model hali ishlamayapti
  db: number;
  loud: boolean;
  lastDetected: { type: EventType; at: number } | null;
  /** ?debug=1 rejimi uchun xom raqamlar */
  debug: { yaw: number | null; pitch: number | null; gaze: number | null; threshold: number | null };
  /** Event yo'li: aniqlandi -> yuborildi -> server javobi */
  pipe: { detected: number; sent: number; acked: number; failed: number; lastAck: string | null; lastError: string | null; ws: boolean };
}

export const useLive = create<LiveSignals>(() => ({ faces: null, db: -100, loud: false, lastDetected: null,
  debug: { yaw: null, pitch: null, gaze: null, threshold: null },
  pipe: { detected: 0, sent: 0, acked: 0, failed: 0, lastAck: null, lastError: null, ws: false } }));

export function pipe(patch: (p: LiveSignals["pipe"]) => Partial<LiveSignals["pipe"]>) {
  useLive.setState(s => ({ pipe: { ...s.pipe, ...patch(s.pipe) } }));
}
