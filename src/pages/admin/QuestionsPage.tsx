import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { reorderQuestions } from "../../api/admin";
import { errMsg } from "../../api/errors";
import type { ExamDetail } from "../../api/types";
import QuestionCard from "../../components/QuestionCard";
import { toast } from "../../components/toast";
import { Button, EmptyState } from "../../components/ui";
import { useExam } from "./ExamLayout";

export default function QuestionsPage() {
  const { exam, refetch, pubErrors } = useExam();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const readOnly = exam.status === "closed" || exam.status === "archived";
  const key = ["exam", String(exam.id)];

  const reorder = useMutation({
    mutationFn: (order: number[]) => reorderQuestions(exam.id, order),
    onError: e => { toast(errMsg(e), "error"); refetch(); },
  });

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = exam.questions.map(x => x.id);
    const next = arrayMove(exam.questions, ids.indexOf(Number(e.active.id)), ids.indexOf(Number(e.over.id)));
    qc.setQueryData<ExamDetail>(key, { ...exam, questions: next });
    reorder.mutate(next.map(x => x.id));
  }

  if (exam.questions.length === 0 && !adding) {
    return (
      <EmptyState
        title="Hali savol yo'q"
        text={readOnly ? "Bu testda savol qo'shilmagan." : "Birinchi savolni qo'shing: matn, variantlar va bitta to'g'ri javob."}
        action={!readOnly && <Button onClick={() => setAdding(true)}>Savol qo'shish</Button>}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {exam.status === "open" && (
        <p className="rounded-md bg-peach/60 px-4 py-3 text-sm">
          Test ochiq. Savollarni faqat hali hech kim boshlamagan bo'lsa o'zgartirish mumkin.
        </p>
      )}
      {!readOnly && exam.questions.length > 1 && (
        <p className="text-[13px] text-ink-subtle">Tartibni o'zgartirish uchun savolni ⋮⋮ belgisidan ushlab suring.</p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={exam.questions.map(x => x.id)} strategy={verticalListSortingStrategy}>
          {exam.questions.map((qq, i) => (
            <QuestionCard key={qq.id} examId={exam.id} index={i} question={qq}
              readOnly={readOnly} serverErrors={pubErrors?.byId[qq.id]} onSaved={refetch} />
          ))}
        </SortableContext>
      </DndContext>
      {adding && (
        <QuestionCard examId={exam.id} index={exam.questions.length} question={null}
          readOnly={false} onSaved={() => { setAdding(false); refetch(); }} onCancelNew={() => setAdding(false)} />
      )}
      {!readOnly && !adding && (
        <button onClick={() => setAdding(true)}
          className="w-full rounded-xl border border-dashed border-border-strong py-5 text-sm font-medium text-ink-muted transition hover:border-ink hover:text-ink">
          + Savol qo'shish
        </button>
      )}
    </div>
  );
}
