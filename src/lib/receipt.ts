/** Chek fayli: backend chegarasi 5 MB, rasm yoki PDF */
export const RECEIPT_MAX = 5 * 1024 * 1024;
export const RECEIPT_ACCEPT = "image/*,application/pdf";

export const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isImage = (f: File) => f.type.startsWith("image/");

/** Rasmni 1600 px gacha kichraytirib JPEG (0.85) qiladi */
async function shrinkImage(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Rasmni o'qib bo'lmadi"));
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Rasmni kichraytirib bo'lmadi");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) throw new Error("Rasmni kichraytirib bo'lmadi");
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Tekshiradi va kerak bo'lsa kichraytiradi. Xato bo'lsa Error (o'zbekcha matn) otadi */
export async function prepareReceipt(file: File): Promise<File> {
  if (isPdf(file)) {
    if (file.size > RECEIPT_MAX) throw new Error("Fayl 5 MB dan oshmasin");
    return file;
  }
  if (!isImage(file)) throw new Error("Faqat rasm yoki PDF yuklang");
  if (file.size <= RECEIPT_MAX) return file;
  const small = await shrinkImage(file);
  if (small.size > RECEIPT_MAX) throw new Error("Rasm juda katta — 5 MB dan kichikroq skrinshot yuklang");
  return small;
}
