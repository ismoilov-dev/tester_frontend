export function fmtDuration(sec: number) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtMinutes(sec: number) {
  const m = Math.round(sec / 60);
  return m < 1 ? `${sec} s` : `~${m} daqiqa`;
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export const num = (v: string | number | null | undefined) => Number(v ?? 0);
export const fmtNum = (v: string | number | null | undefined) => {
  const n = num(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

// datetime-local input <-> ISO
export function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export const fmtSum = (n: number) => `${n.toLocaleString("ru-RU").replace(/ /g, " ")} so'm`;
export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}
/** Necha kun qoldi (yuqoriga yaxlitlangan; o'tgan bo'lsa 0) */
export function daysLeft(iso: string | null | undefined) {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}
