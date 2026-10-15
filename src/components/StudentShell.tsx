import type { ReactNode } from "react";

/** O'quvchi ekranlari uchun umumiy qolip: markazda karta, tepada yumshoq gradient "orb". */
export default function StudentShell({ children, width = "max-w-md", glow = "aurora" }:
  { children: ReactNode; width?: string; glow?: "aurora" | "sunset" | "lagoon" }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-10">
      <div aria-hidden className={`gradient-${glow} pointer-events-none absolute -top-48 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full opacity-60 blur-3xl`} />
      <div className={`relative w-full ${width} rounded-xl border border-border bg-bg/90 p-6 backdrop-blur sm:p-8`}>{children}</div>
    </div>
  );
}

/** Natija/holat ekranlari uchun dumaloq belgi (Lumen: to'ldirilgan ikonlar o'rniga gradient orb + ingichka belgi). */
export function StatusOrb({ glow = "aurora", children }: { glow?: "aurora" | "sunset" | "lagoon"; children: ReactNode }) {
  return (
    <div className={`gradient-${glow} mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full text-2xl text-ink`}>{children}</div>
  );
}
