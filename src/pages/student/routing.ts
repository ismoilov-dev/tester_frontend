import { getState } from "../../api/student";
import { toApiError } from "../../api/errors";
import type { AttemptState } from "../../api/types";
import { syncClock } from "../../lib/clock";
import { useAttempt, type Phase, type ResultKind } from "../../stores/attempt";

export function phaseFor(s: AttemptState): Phase {
  switch (s.status) {
    case "lobby": return "lobby";
    case "in_progress":
    case "disconnected": return "exam";
    case "frozen": return "frozen";
    default: return "result";
  }
}

/** Holatni serverdan qayta olib, mos ekranga o'tkazadi. 401 bo'lsa tokenni o'chirib join'ga. */
export async function refreshState(): Promise<AttemptState | null> {
  const st = useAttempt.getState();
  try {
    const s = await getState();
    syncClock(s.server_time);
    st.applyState(s);
    const phase = phaseFor(s);
    const patch: Partial<ReturnType<typeof useAttempt.getState>> = { phase };
    if (phase === "result") patch.resultKind = (s.status === "rejected" || s.status === "kicked" ? s.status : "submitted") as ResultKind;
    st.set(patch);
    return s;
  } catch (e) {
    const err = toApiError(e);
    if (err.status === 401) {
      st.dropToken();
      st.set({ phase: "join" });
    }
    throw err;
  }
}

export function goResult(kind: ResultKind, extra: { result?: AttemptState["result"]; note?: string } = {}) {
  const patch: Record<string, unknown> = { phase: "result", resultKind: kind };
  if (extra.result !== undefined) patch.result = extra.result;
  if (extra.note !== undefined) patch.note = extra.note;
  useAttempt.getState().set(patch);
}
