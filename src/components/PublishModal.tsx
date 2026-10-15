import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { copyText } from "../lib/format";
import { toast } from "./toast";
import { Button, Modal } from "./ui";

export default function PublishModal({ open, onClose, code, shareUrl }: { open: boolean; onClose: () => void; code: string; shareUrl: string }) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    if (open && shareUrl) QRCode.toDataURL(shareUrl, { width: 220, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, [open, shareUrl]);

  return (
    <Modal open={open} onClose={onClose} title="Test o'quvchilar uchun ochiq" footer={<Button variant="secondary" onClick={onClose}>Yopish</Button>}>
      <div className="flex flex-col items-center gap-5 text-center">
        <p className="text-ink-muted">O'quvchilarga kodni ayting yoki linkni yuboring.</p>
        <div className="gradient-aurora w-full rounded-lg px-4 py-6">
          <p className="text-[13px] text-ink-muted">Test kodi</p>
          <p className="mt-1 font-mono text-4xl font-medium tracking-widest">{code}</p>
        </div>
        {qr && <img src={qr} alt="QR kod" className="h-40 w-40 rounded-md border border-border" />}
        <div className="w-full break-all rounded-md bg-surface-100 px-3 py-2 font-mono text-xs">{shareUrl}</div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={async () => toast(await copyText(shareUrl) ? "Link nusxalandi" : "Nusxalab bo'lmadi")}>Linkni nusxalash</Button>
          <a className="inline-flex h-10 items-center rounded-full border border-border-strong px-[18px] text-sm font-medium shadow-sm transition hover:bg-surface-100"
            target="_blank" rel="noreferrer"
            href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Test kodi: ${code}`)}`}>
            Telegram'da ulashish
          </a>
        </div>
      </div>
    </Modal>
  );
}
