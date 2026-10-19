import { adminApi } from "./client";
import type {
  Exam, ExamDetail, Feedback, FeedbackIn, Paginated, ParticipantDetail, ParticipantRow, PublishResponse, Question, QuestionInput, TokenPair, User,
} from "./types";

export const googleLogin = (idToken: string) =>
  adminApi.post<TokenPair>("/auth/google/", { id_token: idToken }).then(r => r.data);
export const logout = (refresh: string) => adminApi.post("/auth/logout/", { refresh });
export const me = () => adminApi.get<User>("/auth/me/").then(r => r.data);

// Fikr-mulohaza: `me().feedback_due` yoki publish javobidagi `ask_feedback` bo'lsa so'raladi
export const submitFeedback = (data: FeedbackIn) => adminApi.post<Feedback>("/feedback/", data).then(r => r.data);
// Voz kechish — backend boshqa so'ramaydi
export const dismissFeedback = () => adminApi.post("/feedback/dismiss/");

// Testlar
export const listExams = (params: { status?: string; page?: number }) =>
  adminApi.get<Paginated<Exam>>("/admin/exams/", { params }).then(r => r.data);
// Yangi test: vaqt butun test uchun (default 1 soat)
export const createExam = (title: string) =>
  adminApi.post<Exam>("/admin/exams/", { title, timing_mode: "total", total_time_sec: 3600 }).then(r => r.data);
export const getExam = (id: number | string) => adminApi.get<ExamDetail>(`/admin/exams/${id}/`).then(r => r.data);
export const patchExam = (id: number | string, data: Record<string, unknown>) =>
  adminApi.patch<ExamDetail>(`/admin/exams/${id}/`, data).then(r => r.data);
// open test uchun force kerak: backend avval yopadi (ichkaridagilar majburan topshiriladi), keyin o'chiradi
export const deleteExam = (id: number | string, force = false) =>
  adminApi.delete(`/admin/exams/${id}/`, { params: force ? { force: true } : undefined });
export const publishExam = (id: number | string) => adminApi.post<PublishResponse>(`/admin/exams/${id}/publish/`).then(r => r.data);
export const closeExam = (id: number | string) => adminApi.post(`/admin/exams/${id}/close/`).then(r => r.data);
export const archiveExam = (id: number | string) => adminApi.post(`/admin/exams/${id}/archive/`).then(r => r.data);
export const duplicateExam = (id: number | string) => adminApi.post<Exam>(`/admin/exams/${id}/duplicate/`).then(r => r.data);

// Savollar
export const createQuestion = (examId: number | string, data: QuestionInput) =>
  adminApi.post<Question>(`/admin/exams/${examId}/questions/`, data).then(r => r.data);
export const patchQuestion = (qid: number, data: Partial<QuestionInput>) =>
  adminApi.patch<Question>(`/admin/questions/${qid}/`, data).then(r => r.data);
export const deleteQuestion = (qid: number) => adminApi.delete(`/admin/questions/${qid}/`);
export const reorderQuestions = (examId: number | string, order: number[]) =>
  adminApi.post(`/admin/exams/${examId}/questions/reorder/`, { order });
export const uploadQuestionImage = (qid: number, file: File) => {
  const fd = new FormData();
  fd.append("image", file);
  return adminApi.put<Question>(`/admin/questions/${qid}/image/`, fd).then(r => r.data);
};
export const deleteQuestionImage = (qid: number) => adminApi.delete(`/admin/questions/${qid}/image/`);

// Ishtirokchilar
export const listParticipants = (examId: number | string) =>
  adminApi.get<ParticipantRow[]>(`/admin/exams/${examId}/participants/`).then(r => r.data);
export const getParticipant = (pid: string) =>
  adminApi.get<ParticipantDetail>(`/admin/participants/${pid}/`).then(r => r.data);
export const participantAction = (pid: string, action: "accept" | "reject" | "resume" | "kick", note?: string) =>
  adminApi.post<ParticipantDetail>(`/admin/participants/${pid}/${action}/`, note !== undefined ? { note } : {}).then(r => r.data);

// Natijalar
export const getResults = (examId: number | string) =>
  adminApi.get<ParticipantRow[]>(`/admin/exams/${examId}/results/`).then(r => r.data);

export async function downloadResults(examId: number | string, code: string | null) {
  const r = await adminApi.get(`/admin/exams/${examId}/results/export/`, { responseType: "blob" });
  const url = URL.createObjectURL(r.data);
  Object.assign(document.createElement("a"), { href: url, download: `results_${code ?? examId}.xlsx` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
