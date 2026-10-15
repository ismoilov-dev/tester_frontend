/**
 * Kameradan kadr olish. <video> elementi yashirin sahifada yangi kadr bermay qo'yadi,
 * ImageCapture.grabFrame() esa to'g'ridan-to'g'ri trekdan oladi.
 */
export class FrameSource {
  private capture: any = null;

  constructor(private video: HTMLVideoElement | null, private stream: MediaStream | null) {
    const track = stream?.getVideoTracks()[0];
    const IC = (window as any).ImageCapture;
    if (track && IC) {
      try { this.capture = new IC(track); } catch { this.capture = null; }
    }
  }

  /** ImageBitmap (chaqiruvchi close() qilishi kerak) yoki video element; kadr yo'q bo'lsa null. */
  async grab(): Promise<ImageBitmap | HTMLVideoElement | null> {
    if (this.capture && this.stream?.getVideoTracks()[0]?.readyState === "live") {
      try { return await this.capture.grabFrame(); } catch { /* video'ga tushamiz */ }
    }
    const v = this.video;
    return v && v.readyState >= 2 && v.videoWidth ? v : null;
  }
}

export const release = (f: ImageBitmap | HTMLVideoElement | null) => {
  if (f && "close" in f) f.close();
};
