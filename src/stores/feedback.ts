import { create } from "zustand";

/**
 * Fikr so'rash modali holati. Qachon so'rashni backend hal qiladi (`feedback_due` / `ask_feedback`);
 * bu yerda faqat modalni boshqa modal ustiga chiqarmaslik va shu sessiyada qayta ochmaslik.
 */
interface FeedbackPrompt {
  wanted: boolean;
  examId: number | null;
  /** Boshqa muhim modal (masalan PublishModal) ochiq — kutib turamiz */
  blocked: boolean;
  /** Shu sessiyada yopildi (Escape/fon) — sahifa yangilanguncha qayta so'ramaymiz */
  closed: boolean;
  ask: (examId?: number) => void;
  block: (blocked: boolean) => void;
  close: () => void;
}

export const useFeedbackPrompt = create<FeedbackPrompt>((set, get) => ({
  wanted: false,
  examId: null,
  blocked: false,
  closed: false,
  ask: examId => {
    if (get().closed) return;
    set({ wanted: true, examId: examId ?? get().examId });
  },
  block: blocked => set({ blocked }),
  close: () => set({ wanted: false, closed: true }),
}));
