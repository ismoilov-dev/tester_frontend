import axios from "axios";
import { studentApi } from "./client";
import type {
  AnswerOut, AttemptState, EventOutcome, JoinResponse, QuestionOut, Room, StartResponse, SubmitOut,
} from "./types";
import type { ProctorEvent } from "../proctoring/types";

export const getRoom = (code: string) => studentApi.get<Room>(`/rooms/${code}/`).then(r => r.data);
export const joinRoom = (code: string, full_name: string, group: string) =>
  studentApi.post<JoinResponse>(`/rooms/${code}/join/`, { full_name, group }).then(r => r.data);

export const getState = () => studentApi.get<AttemptState>("/attempt/state/").then(r => r.data);
export const sendConsent = (client_info: Record<string, unknown>) =>
  studentApi.post<AttemptState>("/attempt/consent/", { consent: true, client_info }).then(r => r.data);
export const startAttempt = () => studentApi.post<StartResponse>("/attempt/start/").then(r => r.data);
export const answer = (question_id: number, option_id: number | null) =>
  studentApi.post<AnswerOut>("/attempt/answer/", { question_id, option_id }).then(r => r.data);
// goto javobi Swagger'da tavsiflanmagan: {question, server_time} yoki to'g'ridan-to'g'ri QuestionOut bo'lishi mumkin
export const gotoQuestion = (index: number) =>
  studentApi.post<any>("/attempt/goto/", { index }).then(r => {
    const d = r.data ?? {};
    return { question: (d.question ?? d) as QuestionOut, server_time: d.server_time as string | undefined };
  });
export const submitAttempt = () => studentApi.post<SubmitOut>("/attempt/submit/").then(r => r.data);

export const postEvents = (events: ProctorEvent[]) =>
  studentApi.post<EventOutcome[]>("/attempt/events/", { events }).then(r => r.data);
export const uploadScreenshot = (event_id: string, blob: Blob) => {
  const fd = new FormData();
  fd.append("event_id", event_id);
  fd.append("image", blob, "shot.jpg");
  return studentApi.post("/attempt/screenshot/", fd);
};

export const isNetworkError = (e: unknown) => axios.isAxiosError(e) && !e.response;
