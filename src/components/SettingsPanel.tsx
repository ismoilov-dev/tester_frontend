import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { patchExam } from "../api/admin";
import { errMsg } from "../api/errors";
import type { EventType, ExamDetail, Proctoring } from "../api/types";
import { fromLocalInput, toLocalInput } from "../lib/format";
import { EVENT_LABELS } from "../lib/labels";
import { toast } from "./toast";
import { Button, ErrorBox, Hint, Input, Label, Segmented, Textarea, Toggle } from "./ui";

const optInt = z.string().refine(v => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 0), "Butun son kiriting");

const schema = z.object({
  title: z.string().trim().min(1, "Sarlavha kerak").max(200),
  description: z.string(),
  timing_mode: z.enum(["per_question", "total"]),
  total_time_min: optInt,
  allow_back: z.boolean(),
  shuffle_questions: z.boolean(),
  shuffle_options: z.boolean(),
  show_result_after: z.boolean(),
  opens_at: z.string(),
  closes_at: z.string(),
  max_participants: optInt,
  camera: z.boolean(),
  microphone: z.boolean(),
  fullscreen: z.boolean(),
  block_copy_paste: z.boolean(),
  look_away_sec: z.number().min(0.5).max(30),
  voice_sec: z.number().min(0.5).max(30),
  voice_db: z.number().min(-80).max(-5),
  warn_at: optInt,
  freeze_at: optInt,
  auto_reject_at: optInt,
  points: z.record(z.string(), z.string()),
}).superRefine((v, ctx) => {
  if (v.timing_mode === "total" && !(Number(v.total_time_min) > 0))
    ctx.addIssue({ code: "custom", path: ["total_time_min"], message: "Umumiy vaqtni kiriting" });
});
type Form = z.infer<typeof schema>;

const POINT_EVENTS = (Object.keys(EVENT_LABELS) as EventType[]).filter(t => t !== "disconnect");
const s = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const n = (v: string) => (v === "" ? null : Number(v));

function toForm(e: ExamDetail): Form {
  const p = e.proctoring ?? ({} as Proctoring);
  return {
    title: e.title, description: e.description ?? "", timing_mode: e.timing_mode,
    total_time_min: e.total_time_sec ? String(Math.round(e.total_time_sec / 60)) : "",
    allow_back: e.allow_back, shuffle_questions: e.shuffle_questions, shuffle_options: e.shuffle_options,
    show_result_after: e.show_result_after,
    opens_at: toLocalInput(e.opens_at), closes_at: toLocalInput(e.closes_at), max_participants: s(e.max_participants),
    camera: !!p.camera, microphone: !!p.microphone, fullscreen: !!p.fullscreen, block_copy_paste: !!p.block_copy_paste,
    look_away_sec: p.look_away_sec ?? 3, voice_sec: p.voice_sec ?? 2, voice_db: p.voice_db ?? -35,
    warn_at: s(p.warn_at), freeze_at: s(p.freeze_at), auto_reject_at: s(p.auto_reject_at),
    points: Object.fromEntries(POINT_EVENTS.map(t => [t, s(p.points?.[t])])),
  };
}

/** Faqat o'zgargan maydonlar; proctoring ichida ham faqat o'zgargan kalitlar. */
function diff(e: ExamDetail, f: Form): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const top: Record<string, unknown> = {
    title: f.title.trim(), description: f.description, timing_mode: f.timing_mode,
    total_time_sec: f.timing_mode === "total" ? Number(f.total_time_min) * 60 : e.total_time_sec,
    allow_back: f.timing_mode === "total" ? f.allow_back : false,
    shuffle_questions: f.shuffle_questions, shuffle_options: f.shuffle_options, show_result_after: f.show_result_after,
    opens_at: fromLocalInput(f.opens_at), closes_at: fromLocalInput(f.closes_at), max_participants: n(f.max_participants),
  };
  for (const [k, v] of Object.entries(top)) {
    const cur = (e as any)[k];
    const same = k.endsWith("_at") ? (cur ? new Date(cur).getTime() : null) === (v ? new Date(v as string).getTime() : null) : cur === v;
    if (!same) out[k] = v;
  }

  const p = e.proctoring ?? ({} as Proctoring);
  const prox: Record<string, unknown> = {};
  const pv: Record<string, unknown> = {
    camera: f.camera, microphone: f.microphone, fullscreen: f.fullscreen, block_copy_paste: f.block_copy_paste,
    look_away_sec: f.look_away_sec, voice_sec: f.voice_sec, voice_db: f.voice_db,
    warn_at: n(f.warn_at), freeze_at: n(f.freeze_at), auto_reject_at: n(f.auto_reject_at),
  };
  for (const [k, v] of Object.entries(pv)) if ((p as any)[k] !== v && !((p as any)[k] === undefined && v === null)) prox[k] = v;
  const pts: Record<string, number> = {};
  let ptsChanged = false;
  for (const t of POINT_EVENTS) {
    const v = f.points[t];
    if (v !== "") pts[t] = Number(v);
    if (s(p.points?.[t]) !== v) ptsChanged = true;
  }
  if (ptsChanged) prox.points = { ...(p.points ?? {}), ...pts };
  if (Object.keys(prox).length) out.proctoring = prox;
  return out;
}

type Preset = "light" | "standard" | "strict" | "custom";
const PRESETS: Record<Exclude<Preset, "custom">, Pick<Form, "camera" | "microphone" | "fullscreen" | "block_copy_paste">> = {
  light: { camera: false, microphone: false, fullscreen: false, block_copy_paste: true },
  standard: { camera: true, microphone: false, fullscreen: true, block_copy_paste: true },
  strict: { camera: true, microphone: true, fullscreen: true, block_copy_paste: true },
};
const PRESET_HINTS: Record<Preset, string> = {
  light: "Faqat tab almashtirish va nusxalash kuzatiladi. Kamera kerak emas.",
  standard: "Kamera (yuz kuzatuvi), to'liq ekran va nusxalash bloki.",
  strict: "Kamera, mikrofon, to'liq ekran — hammasi yoqilgan.",
  custom: "O'zingiz tanlagan sozlama.",
};

export default function SettingsPanel({ exam, onSaved }: { exam: ExamDetail; onSaved: (e: ExamDetail) => void }) {
  const { register, control, handleSubmit, reset, setValue, formState: { errors, isDirty } } = useForm<Form>({
    resolver: zodResolver(schema), defaultValues: toForm(exam),
  });
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => { reset(toForm(exam)); }, [exam, reset]);

  const timing = useWatch({ control, name: "timing_mode" });
  const camera = useWatch({ control, name: "camera" });
  const mic = useWatch({ control, name: "microphone" });
  const fullscreen = useWatch({ control, name: "fullscreen" });
  const copy = useWatch({ control, name: "block_copy_paste" });

  const preset: Preset = (Object.entries(PRESETS).find(([, v]) =>
    v.camera === camera && v.microphone === mic && v.fullscreen === fullscreen && v.block_copy_paste === copy)?.[0] as Preset) ?? "custom";

  const st = exam.status;
  const all = st === "draft";
  const editable = (field: "title" | "closes_at" | "other") => all || (st === "open" && field !== "other");
  const readOnly = st === "closed" || st === "archived";

  const save = useMutation({
    mutationFn: (f: Form) => {
      const d = diff(exam, f);
      if (!Object.keys(d).length) return Promise.resolve(exam);
      return patchExam(exam.id, d);
    },
    onSuccess: e => { toast("Sozlamalar saqlandi", "success"); onSaved(e); },
    onError: e => toast(errMsg(e), "error"),
  });

  const err = (k: keyof Form) => errors[k]?.message ? <Hint error>{String(errors[k]?.message)}</Hint> : null;
  const toggle = (name: "allow_back" | "shuffle_questions" | "shuffle_options" | "show_result_after" | "camera" | "microphone" | "fullscreen" | "block_copy_paste", label: string, description?: string) => (
    <Controller control={control} name={name} render={({ field }) => (
      <Toggle label={label} description={description} checked={field.value} onChange={field.onChange} disabled={!editable("other")} />
    )} />
  );
  function applyPreset(p: Preset) {
    if (p === "custom") return;
    for (const [k, v] of Object.entries(PRESETS[p])) setValue(k as keyof Form, v as never, { shouldDirty: true });
  }

  return (
    <form onSubmit={handleSubmit(f => save.mutate(f))} className="space-y-6 pb-24">
      {st === "open" && <p className="rounded-md bg-peach/60 px-4 py-3 text-sm">Test ochiq — faqat nom va yopilish vaqtini o'zgartirish mumkin.</p>}
      {readOnly && <p className="rounded-md bg-surface-100 px-4 py-3 text-sm text-ink-muted">Test yopilgan — sozlamalarni faqat ko'rish mumkin.</p>}

      <Section title="Asosiy">
        <label className="block"><Label>Test nomi</Label><Input disabled={!editable("title")} {...register("title")} />{err("title")}</label>
        <label className="block"><Label hint="(ixtiyoriy)">Tavsif</Label><Textarea rows={2} disabled={!editable("other")} placeholder="O'quvchi kirishda ko'radi" {...register("description")} /></label>
      </Section>

      <Section title="Vaqt" description="Har savolga alohida vaqt yoki butun test uchun bitta umumiy vaqt.">
        <Segmented value={timing} disabled={!editable("other")} onChange={m => setValue("timing_mode", m, { shouldDirty: true })}
          options={[{ value: "per_question", label: "Har savolga" }, { value: "total", label: "Umumiy" }]} />
        {timing === "per_question" ? (
          <p className="text-[13px] text-ink-muted">Vaqt har bir savol kartochkasida belgilanadi.</p>
        ) : (
          <>
            <label className="block"><Label>Umumiy vaqt (daqiqa)</Label><Input type="number" min={1} className="max-w-40" disabled={!editable("other")} {...register("total_time_min")} />{err("total_time_min")}</label>
            {toggle("allow_back", "Orqaga qaytish", "O'quvchi oldingi savollarga qaytib javobini o'zgartira oladi")}
          </>
        )}
      </Section>

      <Section title="Savollar va natija">
        {toggle("shuffle_questions", "Savollarni aralashtirish", "Har o'quvchida savollar tartibi har xil")}
        {toggle("shuffle_options", "Variantlarni aralashtirish", "Javob variantlari tartibi har xil")}
        {toggle("show_result_after", "Natijani darhol ko'rsatish", "Test tugagach o'quvchi o'z ballini ko'radi")}
      </Section>

      <Section title="Anti-cheat" description="Test davomida nimalar kuzatilishini tanlang.">
        <Segmented value={preset} disabled={!editable("other")} onChange={applyPreset}
          options={[{ value: "light", label: "Yumshoq" }, { value: "standard", label: "Standart" }, { value: "strict", label: "Qat'iy" },
            ...(preset === "custom" ? [{ value: "custom" as Preset, label: "Maxsus" }] : [])]} />
        <p className="text-[13px] text-ink-muted">{PRESET_HINTS[preset]}</p>
        <div className="divide-y divide-border">
          {toggle("camera", "Kamera", "Yuz ko'rinmasa, chetga qarasa yoki kadrda 2 kishi bo'lsa")}
          {toggle("microphone", "Mikrofon", "Gaplashsa yoki baland ovoz chiqsa")}
          {toggle("fullscreen", "To'liq ekran", "Test faqat to'liq ekranda ishlaydi")}
          {toggle("block_copy_paste", "Nusxalashni bloklash", "Copy / paste ishlamaydi va qayd etiladi")}
        </div>
        <p className="text-[13px] text-ink-muted">Tab almashtirish va boshqa oynaga o'tish har doim kuzatiladi.</p>

        <div className="grid grid-cols-2 gap-3">
          <label className="block"><Label hint="ball">Ogohlantirish</Label><Input type="number" min={0} disabled={!editable("other")} {...register("warn_at")} /></label>
          <label className="block"><Label hint="ball">Testni to'xtatish</Label><Input type="number" min={0} disabled={!editable("other")} {...register("freeze_at")} /></label>
        </div>
        <p className="text-[13px] text-ink-muted">
          Har bir qoidabuzarlik ball qo'shadi. «Ogohlantirish» balida o'quvchi ogohlantiriladi, «To'xtatish» balida test to'xtaydi va sizning qaroringizni kutadi.
        </p>

        <button type="button" className="text-sm font-medium text-ink-muted hover:text-ink" onClick={() => setAdvanced(a => !a)}>
          {advanced ? "▾" : "▸"} Kengaytirilgan sozlamalar
        </button>
        {advanced && (
          <div className="space-y-5 rounded-lg bg-surface-100 p-5">
            <Controller control={control} name="look_away_sec" render={({ field }) => (
              <Slider label="Chetga qarash qancha davom etsa" unit="s" min={0.5} max={15} step={0.5} value={field.value} onChange={field.onChange} disabled={!camera || !editable("other")} />
            )} />
            <Controller control={control} name="voice_sec" render={({ field }) => (
              <Slider label="Gaplashish qancha davom etsa" unit="s" min={0.5} max={15} step={0.5} value={field.value} onChange={field.onChange} disabled={!mic || !editable("other")} />
            )} />
            <Controller control={control} name="voice_db" render={({ field }) => (
              <Slider label="Ovoz sezgirligi (kalibrlanmasa)" unit="dB" min={-70} max={-10} step={1} value={field.value} onChange={field.onChange} disabled={!mic || !editable("other")} />
            )} />
            <label className="block">
              <Label hint="(bo'sh = o'chiq)">Avtomatik rad etish</Label>
              <Input type="number" min={0} className="max-w-40" disabled={!editable("other")} {...register("auto_reject_at")} />
              <Hint>Shu ballga yetsa, test sizsiz avtomatik rad etiladi.</Hint>
            </label>
            <div>
              <Label>Har bir qoidabuzarlik uchun ball</Label>
              <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {POINT_EVENTS.map(t => (
                  <label key={t} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-ink-muted">{EVENT_LABELS[t]}</span>
                    <Input type="number" min={0} className="h-9 w-20" placeholder="—" disabled={!editable("other")} {...register(`points.${t}`)} />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section title="Kirish">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><Label hint="(ixtiyoriy)">Ochilish vaqti</Label><Input type="datetime-local" disabled={!editable("other")} {...register("opens_at")} /></label>
          <label className="block"><Label hint="(ixtiyoriy)">Yopilish vaqti</Label><Input type="datetime-local" disabled={!editable("closes_at")} {...register("closes_at")} /></label>
        </div>
        <label className="block"><Label hint="(bo'sh = cheksiz)">Maksimal ishtirokchi</Label><Input type="number" min={1} className="max-w-40" disabled={!editable("other")} {...register("max_participants")} />{err("max_participants")}</label>
      </Section>

      {Object.keys(errors).length > 0 && <ErrorBox>Formada xatolar bor — qizil maydonlarni tekshiring.</ErrorBox>}

      {!readOnly && isDirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/90 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-ink-muted">Saqlanmagan o'zgarishlar bor</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => reset(toForm(exam))}>Bekor qilish</Button>
              <Button type="submit" loading={save.isPending}>Saqlash</Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border p-6">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {description && <p className="mt-0.5 text-ink-muted">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Slider({ label, unit, min, max, step, value, onChange, disabled }:
  { label: string; unit: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className={`block text-sm ${disabled ? "opacity-45" : ""}`}>
      <div className="mb-1.5 flex justify-between"><span>{label}</span><span className="font-mono text-xs text-ink-muted">{value} {unit}</span></div>
      <input type="range" className="w-full accent-[var(--ink)]" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={e => onChange(Number(e.target.value))} />
    </label>
  );
}
