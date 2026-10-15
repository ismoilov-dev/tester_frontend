import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { joinRoom } from "../../api/student";
import { toApiError } from "../../api/errors";
import StudentShell from "../../components/StudentShell";
import { Badge, Button, ErrorBox, Hint, Input, Label } from "../../components/ui";
import { fmtMinutes } from "../../lib/format";
import { useAttempt } from "../../stores/attempt";
import { refreshState } from "./routing";

const schema = z.object({
  full_name: z.string().trim().min(2, "Kamida 2 belgi").max(120, "Ko'pi bilan 120 belgi"),
  group: z.string().trim().max(60),
});
type Form = z.infer<typeof schema>;

export default function RoomPage({ code }: { code: string }) {
  const room = useAttempt(s => s.room);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema), defaultValues: { full_name: "", group: "" },
  });

  async function onSubmit(f: Form) {
    setError("");
    try {
      const r = await joinRoom(code, f.full_name, f.group);
      useAttempt.getState().setToken(r.participant_token);
      await refreshState();
    } catch (e) {
      const err = toApiError(e);
      if (err.code === "ROOM_FULL") setError("Joy qolmadi");
      else if (err.code === "EXAM_NOT_OPEN") setError("Test hali ochilmagan yoki yopilgan");
      else if (err.status === 429) setError(`Biroz kuting${err.details?.retry_after_seconds ? ` (${err.details.retry_after_seconds} s)` : ""}`);
      else setError(err.message);
    }
  }

  return (
    <StudentShell>
      {room && (
        <div className="mb-7">
          <h1 className="text-[28px] font-semibold leading-[34px] tracking-tight">{room.title}</h1>
          {room.description && <p className="mt-2 whitespace-pre-line text-ink-muted">{room.description}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>{room.questions_count} ta savol</Badge>
            <Badge>{fmtMinutes(room.estimated_time_sec)}</Badge>
            {room.proctoring?.camera && <Badge tone="lilac">Kamera kerak</Badge>}
            {room.proctoring?.microphone && <Badge tone="sky">Mikrofon kerak</Badge>}
            {room.proctoring?.fullscreen && <Badge tone="peach">To'liq ekran</Badge>}
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <label className="block">
          <Label>Ism familiya</Label>
          <Input autoFocus autoComplete="name" placeholder="Masalan: Aliyev Vali" aria-invalid={!!errors.full_name} {...register("full_name")} />
          <Hint error>{errors.full_name?.message}</Hint>
        </label>
        <label className="block">
          <Label hint="(ixtiyoriy)">Guruh</Label>
          <Input placeholder="Masalan: 9-A" {...register("group")} />
        </label>
        <ErrorBox>{error}</ErrorBox>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Kirish</Button>
      </form>
    </StudentShell>
  );
}
