import { FrameSource, release } from "./frameSource";

export async function captureJpeg(src: FrameSource): Promise<Blob | null> {
  const f = await src.grab();
  if (!f) return null;
  const fw = f instanceof HTMLVideoElement ? f.videoWidth : f.width;
  const fh = f instanceof HTMLVideoElement ? f.videoHeight : f.height;
  const w = 640, h = Math.round(fh * (640 / fw));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(f, 0, 0, w, h);
  release(f);
  return new Promise(res => c.toBlob(b => res(b), "image/jpeg", 0.6)); // ≤ 200 KB
}
