import type { EventType, ExamStatus, ParticipantStatus } from "../api/types";
import type { Tone } from "../components/ui";

export const EVENT_LABELS: Record<EventType, string> = {
  tab_hidden: "Boshqa tabga o'tdi",
  window_blur: "Boshqa oynaga o'tdi",
  fullscreen_exit: "To'liq ekrandan chiqdi",
  copy_attempt: "Nusxalashga urindi",
  paste_attempt: "Qo'yishga urindi",
  context_menu: "O'ng tugma",
  devtools_open: "DevTools ochildi",
  look_away: "Ekrandan chetga qaradi",
  no_face: "Yuz ko'rinmadi",
  multiple_faces: "Kadrda bir nechta odam",
  voice_detected: "Gaplashdi / ovoz",
  camera_off: "Kamera o'chdi",
  mic_off: "Mikrofon o'chdi",
  disconnect: "Aloqa uzildi",
};

export const STATUS_LABELS: Record<ParticipantStatus, string> = {
  lobby: "Kutmoqda", in_progress: "Ishlamoqda", frozen: "To'xtatilgan", disconnected: "Aloqa yo'q",
  submitted: "Topshirdi", rejected: "Rad etildi", kicked: "Chiqarildi",
};

export const STATUS_TONES: Record<ParticipantStatus, Tone> = {
  lobby: "neutral", in_progress: "sky", frozen: "blush", disconnected: "peach",
  submitted: "mint", rejected: "danger", kicked: "neutral",
};

/** Admin bir qarashda tushunishi uchun: holat nimani anglatadi. */
export const STATUS_HINTS: Record<ParticipantStatus, string> = {
  lobby: "Kirdi, hali boshlamadi",
  in_progress: "Hozir test yechyapti",
  frozen: "Qoidabuzarlik ko'p — sizning qaroringizni kutyapti",
  disconnected: "Internet uzildi, qaytishi mumkin",
  submitted: "Testni tugatdi",
  rejected: "Natijasi bekor qilindi",
  kicked: "Testdan chiqarildi",
};

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  draft: "Qoralama", open: "Ochiq", closed: "Yopilgan", archived: "Arxiv",
};
export const EXAM_STATUS_TONES: Record<ExamStatus, Tone> = {
  draft: "neutral", open: "mint", closed: "peach", archived: "neutral",
};
export const EXAM_STATUS_HINTS: Record<ExamStatus, string> = {
  draft: "Hali hech kim ko'rmaydi. Savollarni qo'shib, nashr qiling.",
  open: "O'quvchilar kod orqali kira oladi.",
  closed: "Yangi kirish yo'q. Natijalarni ko'rishingiz mumkin.",
  archived: "Arxivlangan test.",
};
