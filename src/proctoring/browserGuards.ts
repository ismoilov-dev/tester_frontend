import type { StudentProctoring } from "../api/types";
import { every } from "../lib/ticker";
import type { Emit } from "./types";

interface GuardOptions {
  config: StudentProctoring;
  emit: Emit;
  onFullscreenChange: (isFull: boolean) => void;
}

const DEVTOOLS_GAP = 160;

/** Barcha brauzer qo'riqchilarini o'rnatadi; qaytgan funksiya hammasini olib tashlaydi. */
export function installBrowserGuards({ config, emit, onFullscreenChange }: GuardOptions) {
  const ac = new AbortController();
  const opt = { signal: ac.signal, capture: true };
  let lastHidden = 0;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      lastHidden = Date.now();
      emit("tab_hidden");
    }
  }, opt);

  // blur va tab_hidden 1 s ichida kelsa — faqat tab_hidden
  window.addEventListener("blur", () => {
    const at = Date.now();
    setTimeout(() => {
      if (ac.signal.aborted) return;
      if (Math.abs(lastHidden - at) <= 1000 || document.hidden) return;
      emit("window_blur");
    }, 1000);
  }, opt);

  if (config.fullscreen) {
    document.addEventListener("fullscreenchange", () => {
      const full = !!document.fullscreenElement;
      onFullscreenChange(full);
      if (!full) emit("fullscreen_exit");
    }, opt);
  }

  if (config.block_copy_paste) {
    const block = (type: "copy_attempt" | "paste_attempt") => (e: Event) => { e.preventDefault(); emit(type); };
    document.addEventListener("copy", block("copy_attempt"), opt);
    document.addEventListener("cut", block("copy_attempt"), opt);
    document.addEventListener("paste", block("paste_attempt"), opt);
  }

  document.addEventListener("contextmenu", e => { e.preventDefault(); emit("context_menu"); }, opt);

  document.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    const blocked =
      e.key === "F12" ||
      (mod && !e.shiftKey && ["c", "v", "x", "p", "s", "u"].includes(k)) ||
      (mod && e.shiftKey && ["i", "j", "c"].includes(k)) ||
      (e.metaKey && e.altKey && ["i", "j", "c"].includes(k)); // macOS: Cmd+Opt+I
    if (blocked) e.preventDefault();
  }, opt);

  window.addEventListener("beforeunload", e => { e.preventDefault(); e.returnValue = ""; }, { signal: ac.signal });

  // DevTools — taxminiy, faqat holat o'zgarganda
  let devOpen = false;
  const stopDev = every(1000, () => {
    const open = window.outerWidth - window.innerWidth > DEVTOOLS_GAP || window.outerHeight - window.innerHeight > DEVTOOLS_GAP;
    if (open && !devOpen) emit("devtools_open");
    devOpen = open;
  });

  return () => {
    ac.abort();
    stopDev();
  };
}
