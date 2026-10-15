import { useQueryClient } from "@tanstack/react-query";
import SettingsPanel from "../../components/SettingsPanel";
import { useExam } from "./ExamLayout";

export default function SettingsPage() {
  const { exam, refetch } = useExam();
  const qc = useQueryClient();
  return (
    <div className="mx-auto max-w-2xl">
      <SettingsPanel exam={exam} onSaved={e => { qc.setQueryData(["exam", String(exam.id)], { ...exam, ...e, questions: e.questions ?? exam.questions }); refetch(); }} />
    </div>
  );
}
