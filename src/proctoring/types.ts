import type { EventType } from "../api/types";

export interface ProctorEvent {
  client_id: string;
  type: EventType;
  duration_ms?: number;
  meta?: Record<string, unknown>;
  client_ts: string;
}

/** Monitorlar chaqiradigan funksiya: event turi + qo'shimcha ma'lumot. */
export type Emit = (type: EventType, extra?: { duration_ms?: number; meta?: Record<string, unknown> }) => void;

export interface ProctorHealth { camera: boolean; mic: boolean; face_engine: boolean; fps: number; }
