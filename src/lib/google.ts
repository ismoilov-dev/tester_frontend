// Google Identity Services — admin login va o'quvchi join uchun umumiy
export const GOOGLE_CLIENT_ID = "1081669938673-a2ali2hc4giaha64o279gnf9fksr72e6.apps.googleusercontent.com";
const GSI_SRC = "https://accounts.google.com/gsi/client";

// GIS skripti bir marta yuklanadi
let gsiPromise: Promise<void> | null = null;
export function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => { gsiPromise = null; reject(new Error("Google skripti yuklanmadi")); };
    document.head.appendChild(s);
  });
  return gsiPromise;
}

export interface GoogleProfile { name: string; email: string; picture: string; }

// ID token (JWT) payload'idan profil — imzo tekshirilmaydi, bu faqat ko'rsatish/ism uchun
export function decodeGoogleCredential(credential: string): GoogleProfile {
  const b64 = credential.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/") ?? "";
  const bin = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "="));
  const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
  const name = (p.name || [p.given_name, p.family_name].filter(Boolean).join(" ") || "").trim();
  return { name, email: p.email ?? "", picture: p.picture ?? "" };
}
