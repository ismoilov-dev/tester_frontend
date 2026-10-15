/**
 * Chrome orqadagi (yashirin/yopilib qolgan) sahifada setTimeout/setInterval ni 1 s — 1 daqiqagacha sekinlashtiradi.
 * Web Worker ichidagi taymerlar bunday cheklanmaydi: worker ritm beradi, ish asosiy oqimda bajariladi.
 */
type Job = { fn: () => void; ms: number; once: boolean };

let worker: Worker | null = null;
let seq = 0;
const jobs = new Map<number, Job>();

const WORKER_SRC = `
const timers = new Map();
onmessage = e => {
  const { cmd, id, ms, once } = e.data;
  if (cmd === "start") timers.set(id, (once ? setTimeout : setInterval)(() => postMessage(id), ms));
  else if (cmd === "stop") { clearTimeout(timers.get(id)); clearInterval(timers.get(id)); timers.delete(id); }
};`;

function getWorker() {
  if (worker) return worker;
  try {
    worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" })));
    worker.onmessage = e => {
      const job = jobs.get(e.data);
      if (!job) return;
      if (job.once) jobs.delete(e.data);
      try { job.fn(); } catch (err) { console.error("[ticker]", err); }
    };
  } catch {
    worker = null; // CSP yoki eski brauzer — oddiy taymerga tushamiz
  }
  return worker;
}

function start(fn: () => void, ms: number, once: boolean): () => void {
  const w = getWorker();
  if (!w) {
    const t = once ? setTimeout(fn, ms) : setInterval(fn, ms);
    return () => { clearTimeout(t); clearInterval(t); };
  }
  const id = ++seq;
  jobs.set(id, { fn, ms, once });
  w.postMessage({ cmd: "start", id, ms, once });
  return () => { jobs.delete(id); w.postMessage({ cmd: "stop", id }); };
}

/** setInterval o'rniga — fon rejimida sekinlashmaydi. Qaytgan funksiya to'xtatadi. */
export const every = (ms: number, fn: () => void) => start(fn, ms, false);
/** setTimeout o'rniga. */
export const after = (ms: number, fn: () => void) => start(fn, ms, true);
