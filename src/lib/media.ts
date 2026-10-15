export async function requestMedia(camera: boolean, microphone: boolean) {
  return navigator.mediaDevices.getUserMedia({
    video: camera ? { width: 640, height: 480 } : false,
    // noiseSuppression/autoGainControl baland ovozni pasaytiradi — aniqlash uchun o'chiramiz
    audio: microphone ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : false,
  });
}

export function mediaErrorText(e: unknown) {
  const name = (e as DOMException)?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Ruxsat berilmadi. Manzil satridagi 🔒 belgisini bosib, kamera va mikrofonga «Ruxsat berish» ni tanlang, so'ng «Qayta urinish» ni bosing.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Kamera yoki mikrofon topilmadi. Qurilma ulanganini tekshiring.";
  if (name === "NotReadableError") return "Kamera boshqa dastur tomonidan band. Zoom, Telegram kabi dasturlarni yoping.";
  if (!window.isSecureContext) return "Kamera faqat HTTPS orqali ishlaydi.";
  return "Kamera/mikrofonni ochib bo'lmadi.";
}

export function clientInfo() {
  return {
    ua: navigator.userAgent,
    screen: `${screen.width}x${screen.height}`,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cores: navigator.hardwareConcurrency,
    lang: navigator.language,
  };
}

export const isTouchDevice = () => window.matchMedia?.("(pointer: coarse)").matches ?? false;

export async function enterFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}
