import { create } from "zustand";
import type { Plan } from "../api/types";

/** Chek yuborish modali (PayModal) — AdminLayout'da bir marta render qilinadi, istalgan joydan ochiladi */
interface PayModalState {
  isOpen: boolean;
  plan: Plan | null;
  open: (plan?: Plan) => void;
  close: () => void;
}

export const usePayModal = create<PayModalState>(set => ({
  isOpen: false,
  plan: null,
  open: plan => set({ isOpen: true, plan: plan ?? null }),
  close: () => set({ isOpen: false }),
}));
