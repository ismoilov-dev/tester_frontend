import { create } from "zustand";
import type { AttemptState, QuestionOut, Result, Room } from "../api/types";
import { session } from "../lib/storage";

export type Phase = "loading" | "error" | "join" | "lobby" | "exam" | "frozen" | "result";
export type ResultKind = "submitted" | "rejected" | "kicked" | "force_submit";

interface Calibration { yaw0: number; pitch0: number; noiseFloor: number | null; }

interface AttemptStore {
  code: string | null;
  token: string | null;
  phase: Phase;
  error: { code: string; message: string; details?: any } | null;
  room: Room | null;
  state: AttemptState | null;
  question: QuestionOut | null;
  violationScore: number;
  warningsCount: number;
  result: Result | null;
  resultKind: ResultKind;
  note: string;
  stream: MediaStream | null;
  calibration: Calibration;
  warning: string | null;

  init: (code: string) => void;
  setToken: (token: string) => void;
  dropToken: () => void;
  set: (patch: Partial<AttemptStore>) => void;
  applyState: (s: AttemptState) => void;
  setStream: (s: MediaStream | null) => void;
  stopStream: () => void;
}

const tokenKey = (code: string) => `pt:${code}`;

export const useAttempt = create<AttemptStore>((set, get) => ({
  code: null,
  token: null,
  phase: "loading",
  error: null,
  room: null,
  state: null,
  question: null,
  violationScore: 0,
  warningsCount: 0,
  result: null,
  resultKind: "submitted",
  note: "",
  stream: null,
  calibration: { yaw0: 0, pitch0: 0, noiseFloor: null },
  warning: null,

  init: code => set({
    code, token: session.get(tokenKey(code)), phase: "loading", error: null, room: null, state: null,
    question: null, violationScore: 0, warningsCount: 0, result: null, resultKind: "submitted", note: "", warning: null,
  }),
  setToken: token => {
    const code = get().code;
    if (code) session.set(tokenKey(code), token);
    set({ token });
  },
  dropToken: () => {
    const code = get().code;
    if (code) session.remove(tokenKey(code));
    set({ token: null, state: null });
  },
  set: patch => set(patch),
  applyState: s => set({
    state: s,
    question: s.question,
    violationScore: s.violation_score,
    warningsCount: s.warnings_count,
    result: s.result,
    note: s.note,
  }),
  setStream: stream => set({ stream }),
  stopStream: () => {
    get().stream?.getTracks().forEach(t => t.stop());
    set({ stream: null });
  },
}));
