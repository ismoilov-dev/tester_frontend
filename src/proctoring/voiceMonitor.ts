import type { StudentProctoring } from "../api/types";
import { every } from "../lib/ticker";
import { useLive } from "./live";
import type { Emit } from "./types";

let ctx: AudioContext | null = null;

/** AudioContext foydalanuvchi bosgan event ichida yaratilishi kerak, aks holda `suspended`. */
export function getAudioContext() {
  if (!ctx || ctx.state === "closed") ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export class LevelMeter {
  private analyser: AnalyserNode;
  private src: MediaStreamAudioSourceNode;
  private buf: Float32Array<ArrayBuffer>;

  constructor(stream: MediaStream) {
    const ac = getAudioContext();
    this.src = ac.createMediaStreamSource(stream);
    this.analyser = ac.createAnalyser();
    this.analyser.fftSize = 2048;
    this.src.connect(this.analyser); // destination ga ULAMANG — aks-sado bo'ladi
    this.buf = new Float32Array(this.analyser.fftSize);
  }

  /** ~ -100 (jim) … 0 (juda baland) */
  levelDb() {
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (const v of this.buf) sum += v * v;
    const rms = Math.sqrt(sum / this.buf.length);
    return 20 * Math.log10(rms || 1e-8);
  }

  dispose() {
    try { this.src.disconnect(); } catch { /* allaqachon uzilgan */ }
  }
}

const GAP_MS = 700;        // so'zlar orasidagi pauzalar (300–600 ms) holatni uzmasin
const LOUD_EXTRA_DB = 8;   // chegaradan shuncha baland bo'lsa — "qattiq ovoz"
const LOUD_MS = 300;       // qattiq ovoz shuncha davom etsa darhol event
const TALK_MAX_MS = 1000;  // oddiy gap: voice_sec, lekin ko'pi bilan 1 s
const ABOVE_NOISE_DB = 12; // kalibrlangan fon shovqinidan shuncha baland — ovoz

export class VoiceMonitor {
  private meter: LevelMeter | null = null;
  private stopTick?: () => void;
  private since: number | null = null;
  private lastLoud = 0;
  private sent = false;
  private peak = -100;
  private threshold: number;

  constructor(private stream: MediaStream, private config: StudentProctoring, noiseFloor: number | null, private emit: Emit) {
    // Lobby'da o'lchangan fon shovqiniga nisbatan (mikrofonlar sezgirligi har xil); bo'lmasa — admin sozlamasi
    this.threshold = noiseFloor === null ? config.voice_db : Math.max(noiseFloor + ABOVE_NOISE_DB, -60);
    useLive.setState(s => ({ debug: { ...s.debug, threshold: Math.round(this.threshold) } }));
  }

  start() {
    if (!this.stream.getAudioTracks().length) return;
    this.meter = new LevelMeter(this.stream);
    if (getAudioContext().state !== "running") console.warn("[proctor] AudioContext:", getAudioContext().state);
    this.stopTick = every(100, this.tick);
  }

  stop() {
    this.stopTick?.();
    this.meter?.dispose();
    this.meter = null;
    useLive.setState({ db: -100, loud: false });
  }

  private loudSince: number | null = null;

  private tick = () => {
    if (!this.meter) return;
    const now = performance.now();
    const db = this.meter.levelDb();
    const loud = db > this.threshold + LOUD_EXTRA_DB;
    useLive.setState({ db, loud: db > this.threshold });
    this.loudSince = loud ? (this.loudSince ?? now) : null;
    if (db > this.threshold) {
      if (this.since === null) { this.since = now; this.peak = db; this.sent = false; }
      this.lastLoud = now;
      this.peak = Math.max(this.peak, db);
    } else if (this.since !== null && now - this.lastLoud > GAP_MS) {
      this.since = null; // holat tugadi
      return;
    }
    const talkMs = Math.min(this.config.voice_sec * 1000, TALK_MAX_MS);
    const talkedLong = this.since !== null && this.lastLoud - this.since >= talkMs;
    const shouted = this.loudSince !== null && now - this.loudSince >= LOUD_MS;
    if (this.since !== null && !this.sent && (talkedLong || shouted)) {
      this.sent = true;
      this.emit("voice_detected", {
        duration_ms: Math.round(this.lastLoud - this.since),
        meta: { db: Math.round(this.peak), loud: shouted },
      });
    }
  };
}
