let offsetMs = 0; // server - client

export function syncClock(serverTimeIso: string | undefined | null) {
  if (!serverTimeIso) return;
  offsetMs = new Date(serverTimeIso).getTime() - Date.now();
}
export const serverNow = () => Date.now() + offsetMs;
export const remainingMs = (deadlineIso: string) => Math.max(0, new Date(deadlineIso).getTime() - serverNow());
