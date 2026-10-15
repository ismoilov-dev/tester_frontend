import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { participantAction } from "../api/admin";
import { errMsg } from "../api/errors";
import { toast } from "./toast";
import { Button, ConfirmModal, Modal, Textarea } from "./ui";

export type PAction = "accept" | "reject" | "resume" | "kick";

/** Qaror amallari uchun modal'lar (rad etish — sabab bilan, chiqarish — tasdiqlash). */
export function useParticipantAction(onDone?: () => void) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<{ pid: string; name: string; action: PAction } | null>(null);
  const [note, setNote] = useState("");

  const m = useMutation({
    mutationFn: ({ pid, action, note }: { pid: string; action: PAction; note?: string }) => participantAction(pid, action, note),
    onSuccess: (_, v) => {
      toast({ accept: "Qabul qilindi", reject: "Rad etildi", resume: "Davom ettirildi", kick: "Chiqarildi" }[v.action], "success");
      qc.invalidateQueries({ queryKey: ["participant", v.pid] });
      setTarget(null);
      onDone?.();
    },
    onError: e => toast(errMsg(e), "error"),
  });

  function run(pid: string, name: string, action: PAction) {
    if (action === "resume") return m.mutate({ pid, action });
    setNote("");
    setTarget({ pid, name, action });
  }

  const needsNote = target?.action === "reject" || target?.action === "accept";
  const modals = (
    <>
      <Modal open={!!target && needsNote} onClose={() => setTarget(null)}
        title={target?.action === "reject" ? `Rad etish — ${target?.name}` : `Qabul qilish — ${target?.name}`}
        footer={<>
          <Button variant="secondary" onClick={() => setTarget(null)}>Bekor qilish</Button>
          <Button variant={target?.action === "reject" ? "danger" : "primary"} loading={m.isPending}
            disabled={target?.action === "reject" && !note.trim()}
            onClick={() => target && m.mutate({ pid: target.pid, action: target.action, note: note.trim() })}>
            {target?.action === "reject" ? "Rad etish" : "Qabul qilish"}
          </Button>
        </>}>
        <label className="block text-sm">
          <span className="mb-1.5 block text-ink-muted">{target?.action === "reject" ? "Sabab (o'quvchiga ko'rsatiladi)" : "Izoh (ixtiyoriy)"}</span>
          <Textarea autoFocus rows={3} value={note} onChange={e => setNote(e.target.value)} />
        </label>
      </Modal>
      <ConfirmModal open={target?.action === "kick"} onClose={() => setTarget(null)} danger
        title={`Chiqarish — ${target?.name ?? ""}`} text="O'quvchi testdan chiqariladi va qayta kira olmaydi."
        confirmText="Chiqarish" loading={m.isPending}
        onConfirm={() => target && m.mutate({ pid: target.pid, action: "kick" })} />
    </>
  );
  return { run, modals, pending: m.isPending };
}
