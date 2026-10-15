export type ExamStatus = "draft" | "open" | "closed" | "archived";
export type TimingMode = "per_question" | "total";
export type ParticipantStatus = "lobby" | "in_progress" | "frozen" | "disconnected" | "submitted" | "rejected" | "kicked";
export type Decision = "accepted" | "rejected" | null;
export type EventType =
  | "tab_hidden" | "window_blur" | "fullscreen_exit" | "copy_attempt" | "paste_attempt" | "context_menu"
  | "devtools_open" | "look_away" | "no_face" | "multiple_faces" | "voice_detected" | "camera_off" | "mic_off"
  | "disconnect"; // disconnect ni faqat server yozadi

export interface Proctoring {
  camera: boolean; microphone: boolean; fullscreen: boolean; block_copy_paste: boolean;
  look_away_sec: number; voice_sec: number; voice_db: number;
  points?: Partial<Record<EventType, number>>;
  warn_at?: number; freeze_at?: number; auto_reject_at?: number | null;
  screenshot_on?: EventType[]; retention_days?: number;
}

// ---- Admin ----
export interface User { id: number; email: string; full_name: string; avatar_url: string; role: "superadmin" | "admin" | "student"; }
export interface TokenPair { access: string; refresh: string; user: User; }

export interface Exam {
  id: number; title: string; description: string;
  code: string | null; share_url: string | null; status: ExamStatus;
  timing_mode: TimingMode; total_time_sec: number | null;
  shuffle_questions: boolean; shuffle_options: boolean; allow_back: boolean; show_result_after: boolean;
  opens_at: string | null; closes_at: string | null; max_participants: number | null;
  proctoring: Proctoring;
  question_count: number; total_points: number; estimated_time_sec: number;
  owner: string; created_at: string; updated_at: string;
}
export interface Option { id: number; text: string; is_correct: boolean; order: number; }
export interface Question {
  id: number; order: number; text: string; image: string | null;
  time_limit_sec: number; points: string; // decimal string: "1.00"
  type: "single"; options: Option[];
}
export interface QuestionInput {
  text: string; time_limit_sec: number; points: string;
  options: { text: string; is_correct: boolean }[];
}
export interface ExamDetail extends Exam { questions: Question[]; }
export interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[]; }
export interface PublishResponse { id: number; code: string; share_url: string; status: ExamStatus; }

export interface ParticipantRow {
  id: string; full_name: string; group: string; status: ParticipantStatus; is_duplicate: boolean; ip: string | null;
  question_index: number; total: number;
  score: string; raw_score: string; max_score: string; percent: number | null;
  violation_score: number; warnings_count: number;
  decision: Decision; decision_note: string; finish_reason: string;
  joined_at: string; started_at: string | null; submitted_at: string | null; last_seen_at: string | null;
}
export interface ViolationEventOut {
  id: string; type: EventType; points: number; duration_ms: number | null; question_id: number | null;
  meta: Record<string, unknown>; screenshot_url: string | null; client_ts: string | null; created_at: string;
}
export interface AdminAnswer {
  question_id: number; question_text: string; option_id: number | null; option_text: string | null;
  is_correct: boolean; correct_option_id: number | null; time_spent_ms: number; answered_at: string;
}
export interface ParticipantDetail extends ParticipantRow {
  consent_at: string | null; client_info: Record<string, unknown>;
  answers: AdminAnswer[]; events: ViolationEventOut[];
}

// ---- O'quvchi ----
export interface Room {
  title: string; description: string; status: ExamStatus; questions_count: number;
  timing_mode: TimingMode; estimated_time_sec: number; opens_at: string | null; closes_at: string | null;
  proctoring: Pick<Proctoring, "camera" | "microphone" | "fullscreen">; retention_days: number;
}
export interface QuestionOut {
  index: number; total: number; id: number; text: string; image: string | null; time_limit_sec: number;
  options: { id: number; text: string }[];
  deadline: string;
  selected_option_id?: number | null; // faqat total + allow_back
}
export interface Result { score: number; max: number; }
export type StudentProctoring = Pick<Proctoring, "camera" | "microphone" | "fullscreen" | "block_copy_paste" | "look_away_sec" | "voice_sec" | "voice_db">;
export interface AttemptState {
  participant_id: string; full_name: string; status: ParticipantStatus; server_time: string; consent: boolean;
  exam: { title: string; timing_mode: TimingMode; allow_back: boolean; questions_count: number; proctoring: StudentProctoring };
  question: QuestionOut | null;
  violation_score: number; warnings_count: number; warn_at: number; freeze_at: number;
  result: Result | null; note: string;
}
export interface JoinResponse { participant_id: string; participant_token: string; status: ParticipantStatus; }
export interface StartResponse { status: ParticipantStatus; server_time: string; question: QuestionOut; }
export interface AnswerOut { accepted: boolean; next_question: QuestionOut | null; finished: boolean; result?: Result | null; server_time?: string; }
export interface SubmitOut { status: ParticipantStatus; result: Result | null; }
export interface EventOutcome {
  client_id: string | null; event_id: string | null; points: number; duplicate: boolean; merged: boolean;
  violation_score: number; status: string; action: string; screenshot_required: boolean;
}
