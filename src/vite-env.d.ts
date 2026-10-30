/// <reference types="vite/client" />

// Google Identity Services (https://accounts.google.com/gsi/client) — faqat ishlatilgan qismlar
interface GoogleCredentialResponse { credential: string; }
interface Window {
  google?: {
    accounts: {
      id: {
        initialize(cfg: { client_id: string; callback: (r: GoogleCredentialResponse) => void; ux_mode?: "popup" | "redirect" }): void;
        renderButton(el: HTMLElement, opts: { theme?: string; size?: string; text?: string; shape?: string; logo_alignment?: "left" | "center"; width?: number; locale?: string }): void;
      };
    };
  };
}
