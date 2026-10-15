import { create } from "zustand";

type Kind = "info" | "success" | "error" | "warning";
interface Toast { id: number; text: string; kind: Kind; }

const useToasts = create<{ list: Toast[] }>(() => ({ list: [] }));
let seq = 0;

export function toast(text: string, kind: Kind = "info", ms = 4000) {
  const id = ++seq;
  useToasts.setState(s => ({ list: [...s.list, { id, text, kind }] }));
  setTimeout(() => useToasts.setState(s => ({ list: s.list.filter(t => t.id !== id) })), ms);
}

const COLORS: Record<Kind, string> = {
  info: "bg-primary text-on-primary",
  success: "bg-primary text-on-primary",
  error: "bg-danger text-white",
  warning: "bg-peach text-ink",
};

export function Toaster() {
  const list = useToasts(s => s.list);
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
      {list.map(t => (
        <div key={t.id} className={`pointer-events-auto rounded-full px-5 py-3 text-center text-sm font-medium shadow-lg ${COLORS[t.kind]}`}>{t.text}</div>
      ))}
    </div>
  );
}
