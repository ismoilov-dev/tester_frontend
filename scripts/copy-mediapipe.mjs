// MediaPipe WASM fayllarini public/ ga ko'chiradi (CDN to'silsa ham ishlashi uchun).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const src = resolve("node_modules/@mediapipe/tasks-vision/wasm");
const dst = resolve("public/mediapipe/wasm");
if (existsSync(src)) {
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log("[mediapipe] wasm -> public/mediapipe/wasm");
}
