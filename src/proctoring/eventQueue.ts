import type { EventOutcome, EventType } from "../api/types";
import { postEvents, uploadScreenshot } from "../api/student";
import { serverNow } from "../lib/clock";
import { toApiError } from "../api/errors";
import { toast } from "../components/toast";
import { every } from "../lib/ticker";
import { pipe } from "./live";
import type { ProctorEvent } from "./types";

const ACK_TIMEOUT = 5000, COOLDOWN = 1000, SHOT_TTL = 30000, BATCH = 20;

interface Pending { ev: ProctorEvent; sentAt: number; viaWs: boolean; }

interface QueueOptions {
  /** WS orqali yuborish; ulanish yo'q bo'lsa false qaytaradi. */
  wsSend: (ev: ProctorEvent) => boolean;
  /** Event sodir bo'lgan zahoti kadr olish (kamera bo'lmasa null). */
  capture: () => Promise<Blob | null>;
  onOutcome: (o: EventOutcome) => void;
}

export class EventQueue {
  private pending = new Map<string, Pending>();
  private shots = new Map<string, { blob: Promise<Blob | null>; at: number }>();
  private lastByType = new Map<EventType, number>();
  private stopTick?: () => void;
  private flushing = false;

  constructor(private opts: QueueOptions) {}

  start() {
    this.stopTick = every(1000, () => this.tick());
  }

  stop() {
    this.stopTick?.();
    this.flush(); // qolganlarini REST orqali yuborib qo'yamiz
  }

  push(type: EventType, extra: { duration_ms?: number; meta?: Record<string, unknown> } = {}) {
    const now = Date.now();
    const last = this.lastByType.get(type) ?? 0;
    if (now - last < COOLDOWN) return false; // lokal cooldown
    this.lastByType.set(type, now);

    const ev: ProctorEvent = {
      client_id: crypto.randomUUID(),
      type,
      client_ts: new Date(serverNow()).toISOString(),
      ...extra,
    };
    this.shots.set(ev.client_id, { blob: this.opts.capture().catch(() => null), at: now });
    const viaWs = this.opts.wsSend(ev);
    console.info(`[proctor] aniqlandi: ${type} -> ${viaWs ? "WS" : "REST"}`, ev);
    pipe(p => ({ detected: p.detected + 1, sent: p.sent + (viaWs ? 1 : 0) }));
    this.pending.set(ev.client_id, { ev, sentAt: now, viaWs });
    if (!viaWs) this.flush();
    return true;
  }

  /** WS ack yoki REST javobining har bir elementi. */
  handleOutcome(o: EventOutcome) {
    console.info("[proctor] server javobi:", o);
    pipe(p => ({ acked: p.acked + 1, lastAck: `${o.action ?? "?"} +${o.points ?? 0} = ${o.violation_score}${o.duplicate ? " (dup)" : ""}` }));
    const id = o.client_id;
    if (id) this.pending.delete(id);
    this.opts.onOutcome(o);
    const shot = id ? this.shots.get(id) : undefined;
    if (id) this.shots.delete(id);
    if (o.screenshot_required && o.event_id && shot) {
      shot.blob.then(b => { if (b) uploadScreenshot(o.event_id!, b).catch(() => {}); });
    }
  }

  /** WS qayta ulanganda — ack kutayotganlarni qayta yuborish xavfsiz (client_id bir xil). */
  resendViaWs() {
    for (const p of this.pending.values()) {
      if (this.opts.wsSend(p.ev)) { p.viaWs = true; p.sentAt = Date.now(); }
    }
  }

  private tick() {
    const now = Date.now();
    for (const [id, s] of this.shots) if (now - s.at > SHOT_TTL) this.shots.delete(id);
    const stale = [...this.pending.values()].some(p => !p.viaWs || now - p.sentAt > ACK_TIMEOUT);
    if (stale) this.flush();
  }

  private async flush() {
    if (this.flushing) return;
    const now = Date.now();
    const batch = [...this.pending.values()]
      .filter(p => !p.viaWs || now - p.sentAt > ACK_TIMEOUT)
      .slice(0, BATCH);
    if (!batch.length) return;
    this.flushing = true;
    pipe(p => ({ sent: p.sent + batch.length }));
    try {
      const res = await postEvents(batch.map(p => p.ev));
      res.forEach(o => this.handleOutcome(o));
      // javobda client_id kelmagan bo'lsa ham, yuborilganlarni o'chiramiz
      batch.forEach(p => this.pending.delete(p.ev.client_id));
    } catch (e) {
      const err = toApiError(e);
      console.error("[proctor] REST /attempt/events/ xatosi:", err.status, err.code, err.message, err.details);
      pipe(p => ({ failed: p.failed + batch.length, lastError: `${err.status} ${err.code}: ${err.message}` }));
      if (err.code !== "NETWORK") {
        toast(`Anti-cheat xatosi: ${err.message}`, "error", 6000);
        if (err.status === 400) { batch.forEach(p => this.pending.delete(p.ev.client_id)); return; } // qayta yuborish foydasiz
      }
      batch.forEach(p => { p.viaWs = false; p.sentAt = Date.now(); }); // keyingi tick'da qayta
    } finally {
      this.flushing = false;
    }
  }
}
