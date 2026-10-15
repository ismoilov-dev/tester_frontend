import { useEffect, useRef } from "react";
import type { EventOutcome, StudentProctoring } from "../api/types";
import { installBrowserGuards } from "./browserGuards";
import { EventQueue } from "./eventQueue";
import { every } from "../lib/ticker";
import { FaceMonitor } from "./faceMonitor";
import { FrameSource } from "./frameSource";
import { captureJpeg } from "./screenshot";
import { useLive } from "./live";
import type { Emit, ProctorEvent, ProctorHealth } from "./types";
import { VoiceMonitor } from "./voiceMonitor";

export interface ProctorOptions {
  config: StudentProctoring;
  stream: MediaStream | null;
  videoEl: HTMLVideoElement | null;
  calibration: { yaw0: number; pitch0: number; noiseFloor: number | null };
  wsSend: (ev: ProctorEvent) => boolean;
  onOutcome: (o: EventOutcome) => void;
  onFullscreenChange: (isFull: boolean) => void;
  onMediaChange: (m: { camera: boolean; mic: boolean }) => void;
}

const trackOk = (t?: MediaStreamTrack) => !!t && t.readyState === "live" && t.enabled && !t.muted;

export class Proctor {
  private queue: EventQueue;
  private stopGuards?: () => void;
  private face?: FaceMonitor;
  private voice?: VoiceMonitor;
  private stopMediaTick?: () => void;
  private media = { camera: true, mic: true };
  private ac = new AbortController();

  constructor(private o: ProctorOptions) {
    this.queue = new EventQueue({
      wsSend: o.wsSend,
      capture: () => (o.config.camera && (o.videoEl || o.stream) ? captureJpeg(new FrameSource(o.videoEl, o.stream)) : Promise.resolve(null)),
      onOutcome: o.onOutcome,
    });
  }

  emit: Emit = (type, extra) => {
    if (this.queue.push(type, extra)) useLive.setState({ lastDetected: { type, at: Date.now() } });
  };

  start() {
    const { config, stream, videoEl } = this.o;
    console.info("[proctor] start — sozlama:", config, "| stream:", !!stream, "| video:", !!videoEl);
    this.queue.start();
    this.stopGuards = installBrowserGuards({ config, emit: this.emit, onFullscreenChange: this.o.onFullscreenChange });

    if (stream) {
      const v = stream.getVideoTracks()[0], a = stream.getAudioTracks()[0];
      v?.addEventListener("ended", () => this.checkMedia(), { signal: this.ac.signal });
      a?.addEventListener("ended", () => this.checkMedia(), { signal: this.ac.signal });
      this.stopMediaTick = every(2000, () => this.checkMedia());
      this.checkMedia();

      if (config.camera) {
        this.face = new FaceMonitor(videoEl, stream, config, this.o.calibration, this.emit);
        this.face.start();
      }
      if (config.microphone) {
        this.voice = new VoiceMonitor(stream, config, this.o.calibration.noiseFloor, this.emit);
        this.voice.start();
      }
    }
  }

  stop() {
    this.ac.abort();
    this.stopGuards?.();
    this.face?.stop();
    this.voice?.stop();
    this.stopMediaTick?.();
    this.queue.stop();
  }

  handleOutcome(o: EventOutcome) { this.queue.handleOutcome(o); }
  resend() { this.queue.resendViaWs(); }

  health(): ProctorHealth {
    const s = this.o.stream;
    return {
      camera: this.o.config.camera ? trackOk(s?.getVideoTracks()[0]) : true,
      mic: this.o.config.microphone ? trackOk(s?.getAudioTracks()[0]) : true,
      face_engine: this.o.config.camera ? !!this.face?.healthy : true,
      fps: this.face?.fps ?? 0,
    };
  }

  private checkMedia() {
    const s = this.o.stream;
    const camera = this.o.config.camera ? trackOk(s?.getVideoTracks()[0]) : true;
    const mic = this.o.config.microphone ? trackOk(s?.getAudioTracks()[0]) : true;
    if (this.media.camera && !camera) this.emit("camera_off");
    if (this.media.mic && !mic) this.emit("mic_off");
    if (camera !== this.media.camera || mic !== this.media.mic) {
      this.media = { camera, mic };
      this.o.onMediaChange(this.media);
    }
  }
}

/**
 * `active` true bo'lganda anti-cheat ishga tushadi, false bo'lganda yoki unmount'da to'xtaydi.
 * Callback'lar ref orqali olinadi — har renderda qayta ishga tushmaydi.
 */
export function useProctoring(active: boolean, opts: ProctorOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const proctorRef = useRef<Proctor | null>(null);
  const { stream, videoEl } = opts;

  useEffect(() => {
    if (!active) return;
    const o = optsRef.current;
    const p = new Proctor({
      ...o,
      wsSend: ev => optsRef.current.wsSend(ev),
      onOutcome: x => optsRef.current.onOutcome(x),
      onFullscreenChange: f => optsRef.current.onFullscreenChange(f),
      onMediaChange: m => optsRef.current.onMediaChange(m),
    });
    proctorRef.current = p;
    p.start();
    return () => {
      p.stop();
      if (proctorRef.current === p) proctorRef.current = null;
    };
  }, [active, stream, videoEl]);

  return proctorRef;
}
