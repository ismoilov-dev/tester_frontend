import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import type { StudentProctoring } from "../api/types";
import { every } from "../lib/ticker";
import { FrameSource, release } from "./frameSource";
import { useLive } from "./live";
import type { Emit } from "./types";

const MP_VERSION = "1.1.1"; // package.json dagi @mediapipe/tasks-vision bilan bir xil
const SOURCES = [
  { wasm: "/mediapipe/wasm", model: "/mediapipe/face_landmarker.task" },
  {
    wasm: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`,
    model: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  },
];

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function create(): Promise<FaceLandmarker> {
  let lastErr: unknown;
  for (const src of SOURCES) {
    for (const delegate of ["GPU", "CPU"] as const) {
      try {
        const vision = await FilesetResolver.forVisionTasks(src.wasm);
        return await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: src.model, delegate },
          runningMode: "VIDEO",
          numFaces: 2, // 2 ta — multiple_faces uchun
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: true, // ko'z qarash yo'nalishi (eyeLookIn/Out)
        });
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw lastErr;
}

/** Modelni bir marta yuklaydi va keshlaydi (lobby va exam bitta nusxadan foydalanadi). */
export function loadLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = create().catch(e => { landmarkerPromise = null; throw e; });
  }
  return landmarkerPromise;
}

/** gaze: ko'zning gorizontal og'ishi, 0 — to'g'ri, 1 — butunlay chetga (bosh burilmasa ham). */
export interface FrameInfo { faces: number; yaw: number | null; pitch: number | null; gaze: number | null; }

let lastTs = 0;
export function analyzeFrame(lm: FaceLandmarker, frame: HTMLVideoElement | ImageBitmap): FrameInfo | null {
  if (frame instanceof HTMLVideoElement && (frame.readyState < 2 || !frame.videoWidth)) return null;
  const ts = Math.max(performance.now(), lastTs + 1); // timestamp qat'iy o'sishi kerak
  lastTs = ts;
  const r = lm.detectForVideo(frame, ts);
  const faces = r.faceLandmarks.length;
  let gaze: number | null = null;
  const bs = r.faceBlendshapes?.[0]?.categories;
  if (bs) {
    const g = (n: string) => bs.find(c => c.categoryName === n)?.score ?? 0;
    // ikkala ko'z bir tomonga: chap ko'z "out" + o'ng ko'z "in" (yoki aksincha)
    const right = (g("eyeLookOutLeft") + g("eyeLookInRight")) / 2;
    const left = (g("eyeLookInLeft") + g("eyeLookOutRight")) / 2;
    gaze = Math.max(right, left);
  }
  const m = r.facialTransformationMatrixes?.[0]?.data;
  if (!m) return { faces, yaw: null, pitch: null, gaze };
  const yaw = Math.atan2(m[8], m[10]) * 180 / Math.PI;   // chap-o'ng
  const pitch = Math.asin(Math.max(-1, Math.min(1, -m[9]))) * 180 / Math.PI; // yuqori-past
  return { faces, yaw, pitch, gaze };
}

// MULTI_MS: 2 ketma-ket kadr (~250 ms) — bir kadrlik xatoni o'tkazib, darhol aniqlaydi
const NO_FACE_MS = 3000, MULTI_MS = 250;
// Chetga qarash ikki darajali:
//  yengil — bosh 25°/20° burilgan: look_away_sec (ko'pi bilan 1.5 s) davom etsa
//  keskin — bosh 40° dan ko'p, ko'z chetga (gaze > 0.55) yoki yuz birdan yo'qoldi: 0.5 s da darhol
const YAW_MILD = 25, PITCH_MILD = 20, YAW_STRONG = 40, GAZE_STRONG = 0.55, STRONG_MS = 500, MILD_MAX_MS = 1500;
const FACE_LOST_GRACE_MS = 2000; // yuz shu vaqt ichida ko'ringan bo'lsa, yo'qolishi = boshni burish

type Episode = { since: number | null; sent: boolean; peak: Record<string, number> };
const episode = (): Episode => ({ since: null, sent: false, peak: {} });

export class FaceMonitor {
  private stopTick?: () => void;
  private busy = false;
  private running = false;
  private frames_ = new FrameSource(null, null);
  private lm: FaceLandmarker | null = null;
  private lastAnalyzed = 0;
  private frames: number[] = [];
  private look = episode();
  private none = episode();
  private multi = episode();
  private strongSince: number | null = null;
  private lastFaceAt = 0;

  constructor(
    video: HTMLVideoElement | null,
    stream: MediaStream | null,
    private config: StudentProctoring,
    private calib: { yaw0: number; pitch0: number },
    private emit: Emit,
  ) {
    this.frames_ = new FrameSource(video, stream);
  }

  async start() {
    this.running = true;
    try { this.lm = await loadLandmarker(); } catch (e) { this.lm = null; console.error("[proctor] yuz modeli yuklanmadi", e); }
    if (this.running && this.lm) this.stopTick = every(125, this.loop); // ~8 FPS, fon rejimida ham
  }

  stop() {
    this.running = false;
    this.stopTick?.();
    useLive.setState({ faces: null });
  }

  /** Model yuklangan va oxirgi 3 s da kamida bitta kadr tahlil qilingan. */
  get healthy() { return !!this.lm && performance.now() - this.lastAnalyzed < 3000; }
  get fps() {
    const now = performance.now();
    this.frames = this.frames.filter(t => now - t < 2000);
    return Math.round(this.frames.length / 2);
  }

  // requestAnimationFrame/setTimeout emas — tab yashirin bo'lsa to'xtaydi yoki sekinlashadi
  private loop = async () => {
    if (!this.running || !this.lm || this.busy) return;
    this.busy = true;
    const frame = await this.frames_.grab();
    try {
      const info = frame && this.running ? analyzeFrame(this.lm, frame) : null;
      if (info) {
        const now = performance.now();
        this.lastAnalyzed = now;
        this.frames.push(now);
        useLive.setState({
          faces: info.faces,
          debug: {
            ...useLive.getState().debug,
            yaw: info.yaw === null ? null : Math.round(info.yaw - this.calib.yaw0),
            pitch: info.pitch === null ? null : Math.round(info.pitch - this.calib.pitch0),
            gaze: info.gaze === null ? null : Math.round(info.gaze * 100) / 100,
          },
        });
        this.evaluate(info, now);
      }
    } catch { /* bitta kadr xatosi — o'tkazib yuboramiz */ }
    release(frame);
    this.busy = false;
  };

  private evaluate(info: FrameInfo, now: number) {
    // Yuz yo'q
    this.track(this.none, info.faces === 0, now, NO_FACE_MS, "no_face");
    // Ko'p yuz
    if (info.faces >= 2) this.multi.peak.count = Math.max(this.multi.peak.count ?? 0, info.faces);
    this.track(this.multi, info.faces >= 2, now, MULTI_MS, "multiple_faces", () => ({ count: this.multi.peak.count }));
    // Chetga qarash
    let mild = false, strong = false;
    if (info.faces >= 1) this.lastFaceAt = now;
    if (info.faces === 1 && info.yaw !== null && info.pitch !== null) {
      const dy = info.yaw - this.calib.yaw0, dp = info.pitch - this.calib.pitch0;
      const gaze = info.gaze ?? 0;
      strong = Math.abs(dy) > YAW_STRONG || gaze > GAZE_STRONG;
      mild = strong || Math.abs(dy) > YAW_MILD || Math.abs(dp) > PITCH_MILD;
      if (mild) {
        this.look.peak.yaw = Math.round(dy);
        this.look.peak.pitch = Math.round(dp);
        this.look.peak.gaze = Math.round(gaze * 100) / 100;
      }
    } else if (info.faces === 0 && now - this.lastFaceAt < FACE_LOST_GRACE_MS + (this.strongSince ? 60_000 : 0)) {
      // bosh keskin burilganda MediaPipe yuzni yo'qotadi — bu ham chetga qarash
      strong = mild = true;
      this.look.peak.face_lost = 1;
    }
    this.strongSince = strong ? (this.strongSince ?? now) : null;
    this.lookAway(mild, now);
  }

  private lookAway(active: boolean, now: number) {
    const ep = this.look;
    if (!active) { ep.since = null; ep.sent = false; ep.peak = {}; this.strongSince = null; return; }
    ep.since ??= now;
    const mildMs = Math.min(this.config.look_away_sec * 1000, MILD_MAX_MS);
    const hit = now - ep.since >= mildMs || (this.strongSince !== null && now - this.strongSince >= STRONG_MS);
    if (!ep.sent && hit) {
      ep.sent = true;
      this.emit("look_away", { duration_ms: Math.round(now - ep.since), meta: { ...ep.peak } });
    }
  }

  /** Holat chegaradan oshganda darhol bitta event; holat tugaguncha qayta yuborilmaydi. */
  private track(ep: Episode, active: boolean, now: number, thresholdMs: number,
                type: "no_face" | "multiple_faces" | "look_away", meta?: () => Record<string, unknown>) {
    if (!active) { ep.since = null; ep.sent = false; ep.peak = {}; return; }
    if (ep.since === null) ep.since = now;
    const dur = now - ep.since;
    if (!ep.sent && dur >= thresholdMs) {
      ep.sent = true;
      this.emit(type, { duration_ms: Math.round(dur), meta: meta?.() });
    }
  }
}
