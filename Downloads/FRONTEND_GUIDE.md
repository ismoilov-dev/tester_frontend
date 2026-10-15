# Tester — Frontend qo'llanma (React + Vite + TypeScript)

Bu hujjat frontendni noldan yozish uchun: ekranlar, oqim, papka tuzilmasi, API/WebSocket bilan ishlash va anti-cheat moduli.
API shartnomasining qisqa ro'yxati — [`FRONTEND_API.md`](FRONTEND_API.md), to'liq spetsifikatsiya — [`TESTER_API_V2.md`](TESTER_API_V2.md), interaktiv — `https://tester-backend.duckdns.org/api/docs/`.

---

## 0. Boshlashdan oldin (backend sozlamasi)

Lokal dev serverdan backendga so'rov yuborish uchun serverdagi `.env` ga dev origin qo'shing, aks holda CORS va WebSocket rad etiladi:

```env
FRONTEND_URL=https://tester.lesson24.uz
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

WebSocket ham shu ro'yxatdan origin tekshiradi (`OriginValidator`). O'zgartirgandan keyin servisni qayta ishga tushiring.

Admin hisobi: serverda `python manage.py createsuperuser --email siz@gmail.com` → frontendda email + parol bilan kirasiz.

---

## 1. Stek

| Kerak | Tanlov | Nega |
|---|---|---|
| Build | Vite + React 18 + TypeScript | |
| Routing | `react-router-dom` v6 | |
| Server holati | `@tanstack/react-query` | kesh, refetch, mutation |
| Lokal holat | `zustand` | auth token, attempt holati |
| HTTP | `axios` (yoki `fetch` wrapper) | interceptor bilan token qo'shish/yangilash |
| Formalar | `react-hook-form` + `zod` | savol formasi, sozlamalar |
| UI | Tailwind CSS (+ ixtiyoriy shadcn/ui) | |
| Yuz tahlili | `@mediapipe/tasks-vision` (FaceLandmarker) | brauzerda, serverga video ketmaydi |
| Ovoz | Web Audio API (kutubxonasiz) | |
| UUID | `crypto.randomUUID()` | event `client_id` |

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm i react-router-dom @tanstack/react-query zustand axios react-hook-form zod @hookform/resolvers @mediapipe/tasks-vision
npm i -D tailwindcss @tailwindcss/vite
```

`.env`:
```env
VITE_API_URL=https://tester-backend.duckdns.org/api
VITE_WS_URL=wss://tester-backend.duckdns.org/ws
```

---

## 2. Papka tuzilmasi

```
frontend/src/
  main.tsx, App.tsx            router + QueryClientProvider
  api/
    client.ts                  axios: adminApi (JWT) va studentApi (participant token)
    errors.ts                  ApiError tipi, xato kodlari
    types.ts                   barcha DTO tiplari (6-bo'lim)
    admin.ts                   admin endpoint funksiyalari
    student.ts                 o'quvchi endpoint funksiyalari
  lib/
    ws.ts                      qayta ulanadigan WebSocket klassi
    clock.ts                   server vaqti bilan sinxron taymer
    storage.ts                 sessionStorage/localStorage o'ramlari (try/catch)
  stores/
    auth.ts                    admin access/refresh, user
    attempt.ts                 o'quvchi: token, status, joriy savol, violation
  proctoring/
    useProctoring.ts           hammasini birlashtiruvchi hook
    browserGuards.ts           tab, blur, fullscreen, copy/paste, contextmenu, devtools
    faceMonitor.ts             MediaPipe: look_away, no_face, multiple_faces
    voiceMonitor.ts            Web Audio: voice_detected
    screenshot.ts              video kadrdan JPEG
    eventQueue.ts              WS orqali yuborish, uzilsa REST zaxira
  pages/
    student/  RoomPage, LobbyPage, ExamPage, FrozenPage, ResultPage
    admin/    LoginPage, ExamsPage, ExamEditorPage, LivePage, ParticipantPage, ResultsPage
  components/ ...
```

---

## 3. Routelar

| Route | Sahifa | Kim |
|---|---|---|
| `/` | Kod kiritish (`dqn-rfab-teu`) yoki admin login havolasi | hamma |
| `/:code` | O'quvchi oqimi (join → lobby → exam → result), bitta sahifa ichida holatga qarab | o'quvchi |
| `/admin/login` | Email + parol | admin |
| `/admin` | Testlar ro'yxati | admin |
| `/admin/exams/:id` | Test muharriri (sozlamalar + savollar) | admin |
| `/admin/exams/:id/live` | Real-time panel | admin |
| `/admin/exams/:id/results` | Natijalar + export | admin |
| `/admin/participants/:pid` | Ishtirokchi tafsiloti, qaror | admin |

`/admin/*` route'larini `RequireAdmin` komponenti bilan o'rang: token yo'q bo'lsa `/admin/login`.

Kod formati: `/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/`. `/admin` route'i kod bilan to'qnashmaydi, chunki format mos kelmaydi; baribir `/admin` ni `/:code` dan **oldin** e'lon qiling.

---

## 4. HTTP klient

### 4.1 Xato formati
Backend har doim:
```json
{ "error": { "code": "EXAM_NOT_OPEN", "message": "Test hali ochilmagan", "details": {} } }
```
```ts
// api/errors.ts
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details: any = {}) { super(message); }
}
export function toApiError(e: any): ApiError {
  const r = e?.response;
  if (!r) return new ApiError(0, "NETWORK", "Internet aloqasi yo'q");
  const err = r.data?.error ?? {};
  return new ApiError(r.status, err.code ?? "UNKNOWN", err.message ?? "Xatolik", err.details);
}
```
`message` o'zbekcha keladi — foydalanuvchiga to'g'ridan-to'g'ri ko'rsatish mumkin. Mantiqni esa `code` bo'yicha quring.

### 4.2 Ikki xil klient
```ts
// api/client.ts
export const adminApi = axios.create({ baseURL: import.meta.env.VITE_API_URL });
export const studentApi = axios.create({ baseURL: import.meta.env.VITE_API_URL });

adminApi.interceptors.request.use(cfg => {
  const t = useAuth.getState().access;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

studentApi.interceptors.request.use(cfg => {
  const t = useAttempt.getState().token;
  if (t) cfg.headers["X-Participant-Token"] = t;
  return cfg;
});
```

### 4.3 Admin token yangilash
- Access 30 daqiqa, refresh 7 kun; refresh **rotatsiya** qilinadi (`/auth/refresh/` yangi `refresh` ham qaytaradi — uni saqlang).
- 401 kelsa: bitta umumiy `refreshPromise` orqali yangilang (bir vaqtda 5 ta so'rov 401 olsa, 5 marta refresh qilmang), so'rovni takrorlang. Refresh ham 401 bersa → logout.
- Admin tokenlari: `localStorage` (try/catch bilan).

### 4.4 O'quvchi tokeni
- `participant_token` → **`sessionStorage`**, kalit `pt:<code>` (bir brauzerda ikki xil test ochilsa aralashmasin).
- Sahifa yangilansa: token bor → `GET /attempt/state/` → holatga qarab ekran.
- `401 INVALID_TOKEN` → tokenni o'chirib, join ekraniga.

---

## 5. Server vaqti va taymer

O'quvchi kompyuter soatiga **ishonmang**. Har `start`, `answer`, `state` javobida `server_time` keladi.

```ts
// lib/clock.ts
let offsetMs = 0; // server - client
export function syncClock(serverTimeIso: string) {
  offsetMs = new Date(serverTimeIso).getTime() - Date.now();
}
export const serverNow = () => Date.now() + offsetMs;
export const remainingMs = (deadlineIso: string) => Math.max(0, new Date(deadlineIso).getTime() - serverNow());
```
- Taymerni `requestAnimationFrame` yoki 250 ms `setInterval` bilan yangilang, har safar `remainingMs(deadline)` dan hisoblang (sekund ayirib bormang — tab fon rejimida interval sekinlashadi).
- `0` ga yetsa: `answer({question_id, option_id: null})` — faqat **bir marta** (flag bilan).
- Javobsiz `answer` yuborilmay qolsa ham server keyingi so'rovda o'zi yopadi; frontend `next_question` ni ko'rsataveradi.

---

## 6. Tiplar (`api/types.ts`)

```ts
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
export interface ExamDetail extends Exam { questions: Question[]; }
export interface Paginated<T> { count: number; next: string | null; previous: string | null; results: T[]; }

export interface ParticipantRow {
  id: string; full_name: string; group: string; status: ParticipantStatus; is_duplicate: boolean; ip: string;
  question_index: number; total: number;
  score: string; raw_score: string; max_score: string; percent: number;
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
export interface AttemptState {
  participant_id: string; full_name: string; status: ParticipantStatus; server_time: string; consent: boolean;
  exam: { title: string; timing_mode: TimingMode; allow_back: boolean; questions_count: number;
          proctoring: Pick<Proctoring, "camera" | "microphone" | "fullscreen" | "block_copy_paste" | "look_away_sec" | "voice_sec" | "voice_db"> };
  question: QuestionOut | null;
  violation_score: number; warnings_count: number; warn_at: number; freeze_at: number;
  result: Result | null; note: string;
}
export interface AnswerOut { accepted: boolean; next_question: QuestionOut | null; finished: boolean; result?: Result | null; }
```

> `points`, `score`, `raw_score`, `max_score` — decimal **string** (`"17.00"`). Ko'rsatishda `Number()` qiling.
> Swagger'dagi tiplar bilan farq bo'lsa, Swagger to'g'ri — bu yerni yangilang.

---

## 7. O'quvchi oqimi

`/:code` sahifasi — bitta **holat mashinasi**. Ekran `phase` ga qarab tanlanadi:

```
loading ─► join ─► lobby ─► exam ⇄ frozen ─► result
   │                                  │
   └─ error (ROOM_NOT_FOUND, EXAM_NOT_OPEN, ROOM_FULL)   rejected / kicked ─► result (sabab bilan)
```

### 7.1 Kirish (loading)
1. `sessionStorage["pt:"+code]` bor bo'lsa → `GET /attempt/state/`:
   - `lobby` → lobby (`consent` true bo'lsa ruxsat qadamini o'tkazib yuborish mumkin)
   - `in_progress` / `disconnected` → exam (`question`, `server_time` bilan)
   - `frozen` → frozen
   - `submitted` / `rejected` / `kicked` → result
   - `401` → tokenni o'chirib, 2-qadam
2. Token yo'q → `GET /rooms/{code}/` → join ekrani (sarlavha, savollar soni, taxminiy vaqt, kamera/mikrofon kerakmi).

Xatolar: `404 ROOM_NOT_FOUND` → "Bunday test topilmadi"; `409 EXAM_NOT_OPEN` → "Test hali ochilmagan yoki yopilgan" (`opens_at` bo'lsa vaqtini ko'rsating); `429` → "Biroz kuting" + `details.retry_after_seconds`.

### 7.2 Join
Forma: **Ism familiya** (majburiy, 2–120 belgi), **Guruh** (ixtiyoriy).
`POST /rooms/{code}/join/ {full_name, group}` → `participant_token` ni saqlang → lobby.
`409 ROOM_FULL` → "Joy qolmadi".

### 7.3 Lobby (eng muhim ekran)
Bosqichlar (stepper):
1. **Rozilik matni** (`retention_days` bilan):
   > Test davomida kamera va mikrofon ishlatiladi. Video va ovoz yozib olinmaydi, serverga yuborilmaydi. Faqat qoidabuzarlik paytida bitta rasm saqlanadi va {retention_days} kundan keyin o'chiriladi.
2. **Ruxsat so'rash**: `navigator.mediaDevices.getUserMedia({ video: {width: 640, height: 480}, audio: true })` — faqat `proctoring.camera/microphone` true bo'lsa. Rad etilsa: brauzer sozlamasidan qanday yoqishni ko'rsating, "Qayta urinish" tugmasi.
3. **Tekshiruv**: video preview + "Yuzingiz aniqlandi ✓" (FaceLandmarker 1 ta yuz ko'rsa) + mikrofon darajasi indikatori. Model yuklanayotganda spinner (birinchi marta ~2–5 MB).
4. `POST /attempt/consent/`:
   ```json
   { "consent": true, "client_info": { "ua": "...", "screen": "1920x1080", "tz": "Asia/Samarkand", "cores": 8, "lang": "uz" } }
   ```
5. **"Testni boshlash"** tugmasi — yuz aniqlanmaguncha `disabled`.

**Muhim:** `MediaStream` ni lobby'dan exam'ga **o'sha-o'sha** uzating (Zustand yoki context). Qayta `getUserMedia` qilmang — ruxsat oynasi yana chiqadi va vaqt yo'qoladi.

Telefon: `proctoring.fullscreen` true bo'lsa va `matchMedia("(pointer: coarse)")` bo'lsa — "Kompyuterdan kiring" ogohlantirishi (backend to'smaydi, siz to'sasiz yoki ogohlantirasiz).

### 7.4 Boshlash
Ketma-ketlik **muhim** (fullscreen faqat foydalanuvchi bosgan event ichida ishlaydi):
```ts
async function onStartClick() {
  if (proctoring.fullscreen) await document.documentElement.requestFullscreen(); // 1. darhol, await dan oldin boshqa narsa yo'q
  const r = await startAttempt();       // 2. POST /attempt/start/
  syncClock(r.server_time);
  setQuestion(r.question);
  proctor.start();                      // 3. anti-cheat yoqiladi
  ws.connect();                         // 4. WebSocket
  setPhase("exam");
}
```
`409 CONSENT_REQUIRED` → consent qadamiga qaytish; `409 ALREADY_STARTED` → `state` olib exam'ga.

### 7.5 Exam ekrani
- Yuqorida: savol `index+1 / total`, **taymer** (oxirgi 10 s qizil), violation indikatori (`violation_score / freeze_at` progress bar), kichik kamera preview (o'quvchi kuzatilayotganini bilsin — bu ham "qo'rqitish" omili).
- Savol matni + rasm (`image` to'liq URL keladi) + variantlar (radio). Variant matni `user-select: none`.
- **"Keyingi"** tugmasi → `POST /attempt/answer/ {question_id, option_id}`:
  - `next_question` bor → ko'rsatish, `syncClock` (agar javobda bo'lsa)
  - `finished: true` → result (`result` null bo'lishi mumkin — `show_result_after=false`)
  - `accepted: false` → kech qoldi, kichik toast "Vaqt tugagan edi", keyingisiga o'tish
- Ikki marta bosishdan himoya: mutation `isPending` paytida tugma `disabled`.
- `timing_mode=total` + `allow_back`: savollar paneli (1..N), `POST /attempt/goto/ {index}`, `selected_option_id` ni belgilab ko'rsatish, oxirida **"Yakunlash"** → tasdiqlash modal → `POST /attempt/submit/`.

Xatolar:
| Kod | Nima qilish |
|---|---|
| `409 WRONG_QUESTION` | `GET /attempt/state/` → joriy savolni ko'rsat |
| `423 ATTEMPT_FROZEN` | frozen ekrani |
| `410 ATTEMPT_FINISHED` | `state` → result |
| `409 NOT_STARTED` | `state` → lobby |
| `NETWORK` | "Aloqa uzildi" banner, 1-2-4-8 s bilan qayta urinish; javobni yo'qotmang |

### 7.6 Frozen ekrani
"Qoidabuzarlik ko'p bo'ldi. Admin tekshirmoqda…" Savol yashirin. WS dan:
- `attempt.resumed {question}` → exam (yangi `deadline`)
- `attempt.rejected {note}` → result
Taymer serverda **to'xtamaydi** — buni ekranda aytmang, lekin resume'dan keyin yangi deadline keladi.

### 7.7 Result ekrani
- `submitted` + `result` → "17 / 20" (foiz bilan); `result: null` → "Javoblaringiz qabul qilindi"
- `rejected` → "Test rad etildi" + `note`
- `kicked` → "Siz testdan chiqarildingiz"
- Hamma holatda: anti-cheat'ni to'xtating, kamera/mikrofon treklarini `track.stop()` qiling, fullscreen'dan chiqing, `sessionStorage` dagi tokenni **qoldiring** (sahifa yangilansa natija qayta ko'rinsin).

---

## 8. Anti-cheat moduli (`proctoring/`)

### 8.1 Umumiy qoidalar
- Har bir qoidabuzarlik uchun **bitta** event — holat chegaradan oshganda (masalan 3 s chetga qaradi → bitta `look_away`, 10 s qarasa ham bitta, `duration_ms` bilan, holat tugaganda yuboriladi yoki chegara oshganda darhol yuboriladi — bittasini tanlang va izchil bo'ling). Tavsiya: **chegara oshganda darhol** yuboring (admin real-time ko'rsin), holat tugagach yana yubormang.
- Bir xil turdagi event uchun lokal 5 s cooldown (server ham debounce qiladi, lekin trafikni tejang).
- Ball, warning, freeze — **server hisoblaydi**. Frontend faqat xabar beradi va server javobini ko'rsatadi.
- Anti-cheat faqat `phase === "exam"` da ishlaydi. Lobby'da, frozen'da, result'da o'chiq.

### 8.2 `useProctoring` interfeysi
```ts
interface ProctorOptions {
  config: AttemptState["exam"]["proctoring"];
  stream: MediaStream | null;
  videoEl: HTMLVideoElement | null;      // yashirin yoki kichik preview
  getQuestionIndex: () => number;
  send: (e: ProctorEvent) => void;       // eventQueue.push
}
interface ProctorEvent { client_id: string; type: EventType; duration_ms?: number; meta?: Record<string, unknown>; client_ts: string; }

const proctor = useProctoring(opts); // { start(), stop(), health: {camera, mic, face_engine, fps} }
```

### 8.3 Brauzer qo'riqchilari (`browserGuards.ts`)
| Event | Qanday | Izoh |
|---|---|---|
| `tab_hidden` | `document.addEventListener("visibilitychange")`, `document.hidden` | eng ishonchli |
| `window_blur` | `window.addEventListener("blur")` | `tab_hidden` bilan 1 s ichida kelsa — faqat `tab_hidden` yuboring |
| `fullscreen_exit` | `fullscreenchange`, `!document.fullscreenElement` | Esc bosganda. "Fullscreen'ga qaytish" tugmali to'liq ekranli overlay ko'rsating (qaytmaguncha savol yashirin) |
| `copy_attempt` / `paste_attempt` | `copy`, `cut`, `paste` → `e.preventDefault()` | `block_copy_paste` true bo'lsa |
| `context_menu` | `contextmenu` → `preventDefault()` | ball 0, faqat log |
| `devtools_open` | `outerWidth - innerWidth > 160` yoki `outerHeight - innerHeight > 160` (1 s da tekshirish) | taxminiy, false positive bor (zoom). Faqat holat o'zgarganda yuboring |
| — | `keydown`: `Ctrl/Cmd + C/V/X/P/S/U`, `F12`, `Ctrl+Shift+I/J/C` → `preventDefault()` | bloklash, event yuborish shart emas |
| — | `beforeunload` → ogohlantirish | sahifadan chiqib ketishdan oldin |

Hammasini `start()` da qo'shib, `stop()` da olib tashlang (`AbortController` signal bilan qulay).

### 8.4 Yuz kuzatuvi (`faceMonitor.ts`)
```ts
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const vision = await FilesetResolver.forVisionTasks(
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm" // versiyani package.json bilan bir xil qiling
);
const landmarker = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    delegate: "GPU",                           // ishlamasa "CPU" ga tushing
  },
  runningMode: "VIDEO",
  numFaces: 2,                                 // 2 ta — multiple_faces uchun
  outputFacialTransformationMatrixes: true,    // bosh burilishi (yaw/pitch)
});
```
- Model va WASM fayllarini production'da o'zingizning `public/` papkangizga ko'chirib, o'sha joydan yuklang (CDN to'silsa test ishlamay qolmasin).
- Tahlil tsikli: **~8 FPS** (`setTimeout(loop, 125)`), `landmarker.detectForVideo(video, performance.now())`. `requestAnimationFrame` ishlatmang — tab yashirin bo'lsa to'xtaydi.
- **Bosh burilishi**: `facialTransformationMatrixes[0].data` (4×4, column-major) dan:
  ```ts
  const m = matrix.data;
  const yaw   = Math.atan2(m[8], m[10]) * 180 / Math.PI;        // chap-o'ng
  const pitch = Math.asin(-m[9]) * 180 / Math.PI;               // yuqori-past
  ```
  Ishoralarni o'zingiz sinab ko'ring (kameraga qarab boshni burib, console'ga chiqaring) — kamera ko'zgu effekti tufayli teskari bo'lishi mumkin.
- **Kalibrlash**: lobby'da 2 s davomida "ekranga qarang" deb, `yaw0/pitch0` o'rtachasini oling; keyin `yaw - yaw0` bilan solishtiring (kamera noutbuk ustida emas, yonda turishi mumkin).
- Qoidalar:
  | Holat | Shart | Event |
  |---|---|---|
  | chetga qarash | `|Δyaw| > 30°` yoki `|Δpitch| > 25°`, `look_away_sec` dan uzoq | `look_away`, `meta: {yaw, pitch}` |
  | yuz yo'q | 0 ta yuz, 3 s dan uzoq | `no_face` |
  | ko'p yuz | ≥2 yuz, 1 s dan uzoq (bir kadrlik xatoni o'tkazib yuborish) | `multiple_faces`, `meta: {count}` |
- Ixtiyoriy: ko'z qorachig'i (iris) bilan ham qarash yo'nalishini aniqlash mumkin (landmark 468–477), lekin bosh burilishi MVP uchun yetarli.
- `face_engine` health: model yuklandi va oxirgi 3 s da kamida bitta kadr tahlil qilindi.

### 8.5 Kamera / mikrofon holati
```ts
stream.getVideoTracks()[0].addEventListener("ended", () => send("camera_off"));
stream.getAudioTracks()[0].addEventListener("ended", () => send("mic_off"));
```
Qo'shimcha: har 2 s `track.readyState === "live" && track.enabled && !track.muted` tekshiring. Kamera o'chsa — to'liq ekranli "Kamerani yoqing" overlay.

### 8.6 Ovoz (`voiceMonitor.ts`)
```ts
const ctx = new AudioContext();
const src = ctx.createMediaStreamSource(stream);
const analyser = ctx.createAnalyser();
analyser.fftSize = 2048;
src.connect(analyser);                      // destination ga ULAMANG — aks-sado bo'ladi
const buf = new Float32Array(analyser.fftSize);

function levelDb() {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0; for (const v of buf) sum += v * v;
  const rms = Math.sqrt(sum / buf.length);
  return 20 * Math.log10(rms || 1e-8);      // ~ -100 (jim) … 0 (juda baland)
}
```
- 100 ms da bir o'lchang. `levelDb() > voice_db` (default `-35`) holati `voice_sec` (default 2 s) dan uzoq davom etsa → `voice_detected`, `meta: {db: max}`. Qisqa jimlik (≤300 ms) holatni uzmasin — gapirishda pauzalar bo'ladi.
- **Fon shovqini kalibrlash**: lobby'da 2 s jimlikni o'lchab, `threshold = max(voice_db, noiseFloor + 15)`.
- `AudioContext` foydalanuvchi bosgandan keyin yaratilsin ("Boshlash" tugmasi) — aks holda `suspended` bo'ladi.
- Ixtiyoriy yaxshilash: faqat nutq chastotalari (300–3400 Hz) energiyasini hisoblash (`getFloatFrequencyData`) — klaviatura taqillashi kamroq ushlanadi.

### 8.7 Screenshot (`screenshot.ts`)
```ts
export async function captureJpeg(video: HTMLVideoElement): Promise<Blob> {
  const w = 640, h = Math.round(video.videoHeight * (640 / video.videoWidth));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(video, 0, 0, w, h);
  return new Promise(res => c.toBlob(b => res(b!), "image/jpeg", 0.6)); // ≤ 200 KB
}
```
Kadrni event **sodir bo'lgan zahoti** oling va xotirada saqlang (ack kelguncha o'quvchi qaytib qaragan bo'ladi). `proctor.ack` da `screenshot_required: true` kelsa:
```ts
const fd = new FormData(); fd.append("event_id", ack.event_id); fd.append("image", blob, "shot.jpg");
await studentApi.post("/attempt/screenshot/", fd);
```
Ack'siz 30 s o'tsa blob'ni tashlab yuboring.

### 8.8 Event navbati (`eventQueue.ts`)
- `push(e)`: `client_id = crypto.randomUUID()`, `client_ts = new Date(serverNow()).toISOString()`.
- WS ochiq → `{"type": "proctor.event", "data": {...}}`; ack kelguncha `pending` Map'da saqlang.
- WS yopiq yoki 5 s ichida ack kelmadi → `POST /attempt/events/ {events: [...]}` (batch, max 20). Javobdagi har element ack bilan bir xil ishlanadi (`action`, `screenshot_required`).
- `client_id` bir xil bo'lgani uchun qayta yuborish xavfsiz — server ikki marta hisoblamaydi.

---

## 9. WebSocket (`lib/ws.ts`)

### 9.1 Umumiy klass
```ts
type Msg = { type: string; data?: any; ts?: string };
export class Socket {
  private ws?: WebSocket; private tries = 0; private closedByUs = false;
  constructor(private url: () => string, private onMessage: (m: Msg) => void,
              private onState?: (open: boolean) => void) {}
  connect() {
    this.closedByUs = false;
    this.ws = new WebSocket(this.url());
    this.ws.onopen = () => { this.tries = 0; this.onState?.(true); };
    this.ws.onmessage = e => this.onMessage(JSON.parse(e.data));
    this.ws.onclose = e => {
      this.onState?.(false);
      if (this.closedByUs || [4401, 4403, 4404, 4410].includes(e.code)) return; // qayta ulanmang
      const delay = Math.min(30000, 1000 * 2 ** this.tries++) + Math.random() * 500;
      setTimeout(() => this.connect(), delay);
    };
  }
  send(type: string, data?: any) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type, data })); }
  close() { this.closedByUs = true; this.ws?.close(); }
  get isOpen() { return this.ws?.readyState === WebSocket.OPEN; }
}
```

### 9.2 O'quvchi socketi
URL: `${VITE_WS_URL}/attempt/?token=${participantToken}`

Yuborish:
- `proctor.heartbeat` har **10 s**: `{question_index, camera, mic, face_engine, fps}`
- `proctor.event` (8.8)

Qabul qilish:
| `type` | Frontend |
|---|---|
| `proctor.ack` | pending'dan o'chirish, `violation_score` ni yangilash, `screenshot_required` → yuborish |
| `proctor.warning` | sariq modal/toast: `message` + "Yana {freeze_at - violation_score} ball qolsa test to'xtatiladi" |
| `attempt.frozen` | phase = frozen |
| `attempt.resumed` | phase = exam, `question` ni o'rnatish |
| `attempt.rejected` | phase = result (rejected, `note`) |
| `attempt.force_submit` | phase = result (`result`) — "Test admin tomonidan yakunlandi" |
| `attempt.kicked` | phase = result (kicked) |
| `error` | console + kerak bo'lsa toast |

Qayta ulanganda: `GET /attempt/state/` qilib holatni yangilang (uzilish paytida savollar o'tib ketgan bo'lishi mumkin).
Close `4410` → result; `4401` → token yaroqsiz, join'ga.

### 9.3 Admin socketi
URL: `${VITE_WS_URL}/admin/exams/${examId}/?token=${accessToken}`
- Access token 30 daqiqada eskiradi: `4401` bilan yopilsa → refresh qilib qayta ulaning (`url` funksiya bo'lgani uchun har ulanishda yangi token olinadi).
- Ulanganda `room.snapshot` keladi — ro'yxatni to'liq almashtiring.
- Keyingi xabarlar — ro'yxatdagi bitta qatorni `id` bo'yicha yangilang (`participant.joined` → qo'shish).
- Qayta ulanganda yoki "Yangilash" tugmasida: `send("refresh")`.

---

## 10. Admin panel

### 10.1 Login (`/admin/login`)
`POST /auth/login/ {username: email, password}` → `{access, refresh, user}`. Xato `401 invalid_credentials` → "Email yoki parol noto'g'ri". `429` → throttling.
Chiqish: `POST /auth/logout/ {refresh}` → tokenlarni o'chirish.

### 10.2 Testlar ro'yxati (`/admin`)
- `GET /admin/exams/?status=&page=` (20 tadan, `Paginated<Exam>`)
- Tablar: Hammasi / Qoralama / Ochiq / Yopilgan / Arxiv
- Kartochka: sarlavha, status badge, savollar soni, `estimated_time_sec`, ochiq bo'lsa **kod + "Linkni nusxalash"** (`share_url`), tugmalar: Tahrirlash · Live · Natijalar · Nusxa · O'chirish (faqat draft)
- "Yangi test" → `POST /admin/exams/ {title}` → muharrirga

### 10.3 Test muharriri (`/admin/exams/:id`)
Ikki ustun: chapda **savollar**, o'ngda **sozlamalar**. `GET /admin/exams/{id}/` (`ExamDetail`).

**Savol kartochkasi** (inline tahrir):
- Matn (textarea), rasm (yuklash/o'chirish: `PUT|DELETE /admin/questions/{qid}/image/`, multipart `image`, ≤ 2 MB)
- Vaqt (soniya; 10–1800; tezkor tugmalar 15/30/60/120) — faqat `per_question` rejimida ko'rinadi
- Ball (default 1)
- Variantlar: matn + radio "to'g'ri", qo'shish/o'chirish (min 2), drag bilan tartib
- Saqlash: yangi → `POST /admin/exams/{id}/questions/`, mavjud → `PATCH /admin/questions/{qid}/` (`options` yuborilsa **to'liq almashtiriladi** — hammasini yuboring)
- O'chirish: `DELETE /admin/questions/{qid}/`
- Tartib: drag-and-drop → `POST /admin/exams/{id}/questions/reorder/ {order: [qid,...]}` (`@dnd-kit/sortable` qulay)

**Sozlamalar** (`PATCH /admin/exams/{id}/`):
- Sarlavha, tavsif
- Vaqt rejimi: har savolga / umumiy (`total_time_sec`), `allow_back` (faqat umumiyda)
- Aralashtirish: savollar, variantlar
- Natijani ko'rsatish
- Ochilish/yopilish vaqti, maksimal ishtirokchi
- **Anti-cheat** bo'limi: kamera, mikrofon, fullscreen, copy-paste blok; `look_away_sec`, `voice_sec`, `voice_db` (slider); `warn_at`, `freeze_at`, `auto_reject_at` (bo'sh = o'chiq); har event uchun ball (ixtiyoriy, kengaytirilgan). `proctoring` PATCH'da faqat o'zgargan kalitlarni yuboring.

**Holatga qarab qulflash:**
- `draft` — hammasi tahrirlanadi
- `open` — faqat `title`, `closes_at`; savollar faqat hech kim boshlamagan bo'lsa (aks holda `409 EXAM_LOCKED` → "Test boshlangan, savollarni o'zgartirib bo'lmaydi")
- `closed/archived` — faqat ko'rish

**Nashr qilish:** `POST /admin/exams/{id}/publish/` → modal: katta kod, `share_url`, "Nusxalash", "Telegram'da ulashish" (`https://t.me/share/url?url=...`), QR kod (ixtiyoriy, `qrcode` paketi).
`422 PUBLISH_VALIDATION` → `details.questions[]` dagi xatolarni tegishli savol kartochkasida qizil ko'rsating.

Boshqa amallar: **Yopish** (`/close/`, tasdiqlash: "Ichkaridagilar majburan topshiriladi"), **Arxivlash** (`/archive/`, faqat closed), **Nusxa** (`/duplicate/` → yangi draft'ga o'tish).

### 10.4 Live panel (`/admin/exams/:id/live`)
Eng ko'p ishlatiladigan ekran. Yuqorida: kod + nusxalash, statistikalar (lobbyda / jarayonda / frozen / topshirgan), "Testni yopish".

Jadval (yoki kartochkalar grid'i), har qator:
| Ustun | Manba |
|---|---|
| Ism, guruh, `is_duplicate` belgisi ("takror") | snapshot / joined |
| Holat badge | `status` |
| Progress `question_index+1 / total` | progress |
| Violation `score / freeze_at` (rangli bar) | violation |
| Salomatlik: 📷 🎤 🙂 (kamera, mikrofon, face_engine) | `health` |
| Oxirgi faollik / "aloqa yo'q 45 s" | `last_seen_at`, heartbeat_lost |
| Amallar | |

- `frozen` qatorlari **tepaga** chiqsin va ajralib tursin (qizil fon + ovozli signal ixtiyoriy). Tugmalar: **Davom ettirish** (`/resume/`), **Rad etish** (`/reject/ {note}` — sabab so'raladigan modal), **Ko'rish**.
- Har qatorda: Ko'rish → `/admin/participants/:pid`, Chiqarish (`/kick/`, tasdiqlash).
- `participant.violation` kelganda: qatorni bir lahza yoritish + o'ng panelda **event lentasi** ("Jasur — chetga qaradi 4.2 s, +1"), `screenshot_url` bo'lsa kichik rasm.
- Filtrlar: hammasi / faqat muammolilar / holat bo'yicha; qidiruv ism bo'yicha.

### 10.5 Ishtirokchi tafsiloti (`/admin/participants/:pid`)
`GET /admin/participants/{pid}/` (`ParticipantDetail`):
- Sarlavha: ism, guruh, IP, holat, ball, violation, qaror
- **Eventlar vaqt chizig'i**: tur (o'zbekcha nom), vaqti, davomiyligi, ball, qaysi savolda, screenshot (bosilsa kattalashadi)
- **Javoblar**: savol, tanlangan variant, to'g'ri variant, ✓/✗, sarflangan vaqt
- `client_info` (brauzer, ekran)
- Qaror tugmalari: **Qabul qilish** (`/accept/ {note}`), **Rad etish** (`/reject/ {note}`), frozen bo'lsa **Davom ettirish**

`screenshot_url` 10 daqiqa amal qiladi — sahifa uzoq ochiq tursa, rasm ochilmasa `refetch` qiling (React Query `staleTime: 5 * 60_000`).

### 10.6 Natijalar (`/admin/exams/:id/results`)
`GET /admin/exams/{id}/results/` — tartiblangan ro'yxat (ball ↓, violation ↑). Ustunlar: #, ism, guruh, ball, foiz, violation, ogohlantirish, qaror, takror, boshlagan/topshirgan vaqt.
**Excel yuklab olish**: `GET /admin/exams/{id}/results/export/` — Authorization header kerak, shuning uchun `<a href>` emas:
```ts
const r = await adminApi.get(`/admin/exams/${id}/results/export/`, { responseType: "blob" });
const url = URL.createObjectURL(r.data);
Object.assign(document.createElement("a"), { href: url, download: `results_${code}.xlsx` }).click();
URL.revokeObjectURL(url);
```

---

## 11. Event turlarining o'zbekcha nomlari (UI uchun)

```ts
export const EVENT_LABELS: Record<EventType, string> = {
  tab_hidden: "Boshqa tabga o'tdi",
  window_blur: "Boshqa oynaga o'tdi",
  fullscreen_exit: "To'liq ekrandan chiqdi",
  copy_attempt: "Nusxalashga urindi",
  paste_attempt: "Qo'yishga urindi",
  context_menu: "O'ng tugma",
  devtools_open: "DevTools ochildi",
  look_away: "Ekrandan chetga qaradi",
  no_face: "Yuz ko'rinmadi",
  multiple_faces: "Kadrda bir nechta odam",
  voice_detected: "Gaplashdi / ovoz",
  camera_off: "Kamera o'chdi",
  mic_off: "Mikrofon o'chdi",
  disconnect: "Aloqa uzildi",
};
export const STATUS_LABELS: Record<ParticipantStatus, string> = {
  lobby: "Kutmoqda", in_progress: "Ishlamoqda", frozen: "To'xtatilgan", disconnected: "Aloqa yo'q",
  submitted: "Topshirdi", rejected: "Rad etildi", kicked: "Chiqarildi",
};
```

---

## 12. Yozish tartibi (tavsiya)

1. **Skelet**: Vite, router, Tailwind, React Query, `api/client.ts`, `errors.ts`, `types.ts`
2. **Admin login** + `RequireAdmin` + token refresh
3. **Testlar ro'yxati** + **muharrir** (savol CRUD, sozlamalar, publish modal) — endi haqiqiy test yaratib, link olasiz
4. **O'quvchi oqimi anti-cheat'siz**: join → lobby (faqat consent) → exam (taymer, answer) → result. Ikkita brauzer oynasida sinang
5. **Admin live panel** (WS snapshot, progress)
6. **Brauzer qo'riqchilari** (tab, fullscreen, copy-paste) + event navbati + warning/frozen ekranlari + admin resume/reject
7. **Kamera**: lobby tekshiruvi, `no_face`, `multiple_faces`, `look_away`, screenshot
8. **Mikrofon**: `voice_detected`
9. Ishtirokchi tafsiloti, natijalar, Excel
10. Sayqal: reconnect, xato holatlari, mobil ogohlantirish, yuklanish holatlari

---

## 13. Sinash ro'yxati

- [ ] Sahifani test o'rtasida yangilash → o'sha savol, to'g'ri qolgan vaqt
- [ ] Internetni 20 s o'chirib yoqish → davom etadi; 70 s → admin "disconnected" ko'radi
- [ ] Taymer 0 → avtomatik keyingi savol, faqat bitta `answer` so'rovi
- [ ] Kompyuter soatini 5 daqiqa oldinga surish → taymer baribir to'g'ri
- [ ] Tab almashtirish → admin panelda 1–2 s ichida ko'rinadi
- [ ] Esc → fullscreen overlay, qaytmaguncha savol yashirin
- [ ] `freeze_at` ga yetish → o'quvchida frozen, adminda tepada; resume → yangi deadline bilan davom
- [ ] Reject → o'quvchida darhol rad etildi ekrani
- [ ] Ikkinchi odam kadrga kirsa → `multiple_faces`, screenshot adminda ko'rinadi
- [ ] Kamera qopqog'ini yopish → `no_face`
- [ ] Baland ovozda gapirish 3 s → `voice_detected`; klaviatura taqillashi → yo'q
- [ ] Admin testni yopsa → hamma o'quvchida "Test yakunlandi"
- [ ] Zaif noutbukda FPS ≥ 5, CPU 100% ga chiqmaydi
- [ ] Rozilik bermasdan "Boshlash" ishlamaydi

---

## 14. Deploy

`npm run build` → `dist/` → serverda Nginx:
```nginx
server {
    server_name tester.lesson24.uz;
    root /var/www/tester-frontend/dist;
    location / { try_files $uri /index.html; }          # SPA: /dqn-rfab-teu ham index.html ga
    location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
    location ~* \.(task|wasm)$ { expires 30d; }          # MediaPipe model/wasm (public/ dan bo'lsa)
}
```
SSL: `certbot --nginx -d tester.lesson24.uz`. Kamera va mikrofon **faqat HTTPS** (yoki `localhost`) da ishlaydi.
Backend `.env`: `FRONTEND_URL=https://tester.lesson24.uz` (CORS va WS shu origin'ni avtomatik ruxsat beradi).
