# Premium (P2P chek bilan to'lov) — Frontend qo'llanma

Loyiha: `tester_frontend` (React 18 + Vite + TS + Tailwind 4 + TanStack Query + zustand + axios)
Backend: `https://tester-backend.duckdns.org/api` (schema: `/api/schema/`, docs: `/api/docs/`)
Sana: 2026-11-16

Maqsad: premiumni **P2P** usulida sotish. Foydalanuvchi kartaga pul o'tkazadi, chek rasmini yuklaydi, admin (siz) tasdiqlaydi, o'qituvchi yoki o'quv markazga 30 kunlik premium ochiladi. Premium yo'q payti UI chiroyli qilib premium olishga undaydi. Premium olingach butun loyihada premium holati ko'rinib turadi va tabrik oynasi chiqadi.

| Tarif | Narx (so'm / 30 kun) |
|---|---|
| O'qituvchi (`teacher`) | 49 000 |
| O'quv markaz (`center`) | 300 000 |

---

## 1. Hozirgi holat (repo tahlili)

Billing frontendda **allaqachon bor**, lekin to'lov qismi soxta. Muhim topilmalar:

| # | Topilma | Fayl | Og'irligi |
|---|---|---|---|
| F1 | **Soxta to'lov.** `PayCard` va `PremiumPage` `OnlinePayModal` ni ochadi. U `payOnline()` ni chaqiradi, bu esa faqat `billingMock` (localStorage) bilan ishlaydi. Serverga hech narsa ketmaydi, lekin foydalanuvchi "Premium faollashtirildi 🎉" ni ko'radi. Bu aldov. | `OnlinePayModal.tsx`, `api/admin.ts` | Kritik |
| F2 | **Mock fallback xavfli.** `withMock()` billing endpointlaridan istalgan `404` kelsa mock rejimga o'tib ketadi va shu sessiya davomida soxta ma'lumot ko'rsatadi. Backend billing endi deploy qilingan (`/billing/*` schema'da bor), shuning uchun fallback kerak emas. | `api/admin.ts`, `api/billingMock.ts` | Yuqori |
| F3 | Narx xato: `PLANS` da markaz 400 000. Kerakli narx 300 000. | `lib/plans.ts` | Yuqori |
| F4 | `submitPayment` `center_name` yubormaydi. Backend `plan=center` da uni majburiy qiladi. | `api/admin.ts` | Yuqori |
| F5 | `Payment` tipida `center_name` yo'q. | `api/types.ts` | O'rta |
| F6 | Matnlar eskirgan: "Karta orqali to'lov — darhol tasdiqlanadi", "Click yoki Payme". | `BillingPage`, `PremiumPage` | O'rta |
| F7 | Chek tasdiqlanganini bilish faqat `/admin/billing` sahifasida (5 s polling). Boshqa sahifada o'tirgan foydalanuvchi tabrik ko'rmaydi. | `BillingPage.tsx` | O'rta |
| F8 | Rad etilgan chek (`rejected` + `admin_note`) hech qayerda ko'rsatilmaydi. `PayCard` faqat `pending` ni biladi. | `BillingPage.tsx` | O'rta |
| F9 | Premium belgisi faqat headerdagi umumiy "Premium" tugmasi. Premium faol bo'lsa ham o'zgarmaydi. | `AdminLayout.tsx` | Dizayn |
| F10 | Paywall (`SUBSCRIPTION_REQUIRED`) faqat Publish tugmasida. Boshqa joyda undov yo'q. | `ExamLayout.tsx` | Dizayn |

Yaxshi tayyor bo'lganlar (qayta ishlatiladi): `Confetti`, `gradient-aurora`, `Badge/Card/Modal/Button/Input/Toggle` (`components/ui.tsx`), `daysLeft/fmtDate/fmtSum/copyText` (`lib/format.ts`), `User.has_access` va `access_until` (`/auth/me/`), `AdminLayout` dagi muddat banneri, `PremiumCard` va `WelcomeBanner` (`BillingPage.tsx`).

---

## 2. Backend API tahlili

Manba: `/api/schema/` (OpenAPI), 2026-11-16 da o'qildi. `/billing/*` endpointlariga **JWT kerak**, shuning uchun javoblarning haqiqiy ma'lumotini tekshirib ko'rmadim, faqat schema'ni o'qidim.

### 2.1 Endpointlar

| Metod | URL | Vazifa | Frontend |
|---|---|---|---|
| GET | `/auth/me/` | `User` (`has_access`, `access_until`) | bor |
| GET | `/billing/plans/` | `{ plans: Plan[], card: {number, holder} }` | **yangi** (hozir ishlatilmaydi) |
| GET | `/billing/me/` | `BillingInfo` | bor |
| GET | `/billing/payments/` | mening to'lovlarim (yangisi birinchi) | **yangi** |
| POST | `/billing/payments/` | chek yuborish, `multipart/form-data` | tuzatiladi |
| GET / POST | `/billing/members/` | markaz o'qituvchilari / qo'shish `{email}` | bor |
| DELETE | `/billing/members/{id}/` | chiqarish (204) | bor |
| POST | `/admin/exams/{id}/publish/` | nashr, premium kerak | bor |

Tasdiqlash/rad etish uchun **API endpoint yo'q**. `admin_note` tavsifida "Avval yozib saqlang, keyin «Rad etish»" deyilgan, ya'ni tasdiqlash Django admin'da qilinadi. Frontend faqat natijani o'qiydi.

### 2.2 Tiplar (schema'dan)

```ts
type Plan = "teacher" | "center";
type PaymentStatus = "pending" | "approved" | "rejected";

interface PlanInfoApi { code: Plan; title: string; price: number; period_days: number; max_teachers: number | null }
interface PlansResponse { plans: PlanInfoApi[]; card: { number: string; holder: string } }

interface Payment {
  id: number; plan: Plan; amount: number;       // so'm
  center_name: string;                           // faqat center uchun
  status: PaymentStatus;
  admin_note: string;                            // rad etish sababi
  created_at: string; reviewed_at: string | null;
}

interface BillingInfo {
  plan: Plan; has_access: boolean;
  access_until: string | null; trial_until: string | null; paid_until: string | null;
  is_center_owner: boolean;
  center: { owner_email: string; name: string; until: string | null } | null;
  pending_payment: Payment | null; last_payment: Payment | null;
  prices: Record<string, number>;
  card: { number: string; holder: string };
  max_teachers: number;
}
```

`POST /billing/payments/` maydonlari: `plan` (majburiy), `receipt` (majburiy, rasm yoki PDF, **≤ 5 MB**), `center_name` (`plan=center` bo'lsa majburiy, ≤ 150 belgi).

### 2.3 API bo'yicha xatolar va kamchiliklar

Schema'ga qarab topilganlar. Backend dasturchisiga (yoki o'zingizga) berish uchun.

| # | Muammo | Ta'siri | Tavsiya |
|---|---|---|---|
| A1 | Billing va publish endpointlarida schema faqat `200/201/204` ni ko'rsatadi. `409 PAYMENT_PENDING` faqat matn tavsifida. `SUBSCRIPTION_REQUIRED` publish uchun schema'da umuman yo'q, frontend esa shunga tayanadi (`ExamLayout.tsx`). | Frontend xato kodlarini taxmin qiladi | `@extend_schema(responses=...)` bilan `400/402/403/409/413` va xato kodlarini yozing |
| A2 | Xato kodlari aralash: `not_authenticated` (kichik harf) va `PAYMENT_PENDING`, `PUBLISH_VALIDATION` (katta harf). | `err.code === "..."` tekshiruvlari adashadi | Hammasini bir xil qiling. Frontendda vaqtincha `code.toUpperCase()` bilan solishtiring |
| A3 | `GET /billing/plans/` token talab qiladi (401). | Ochiq narx sahifasi uchun ishlamaydi. `/admin` baribir login talab qiladi, shuning uchun hozir muammo emas | Faqat bilib qo'ying |
| A4 | Chek yuborilgach uni **almashtirib/bekor qilib bo'lmaydi**. `pending` bo'lsa yangisi `409`. Foydalanuvchi noto'g'ri rasm yuborsa admin rad etguncha kutadi. | UX qiyin | `DELETE /billing/payments/{id}/` (faqat `pending`) qo'shing |
| A5 | `Payment` da chek rasmiga havola yo'q. Foydalanuvchi nima yuborganini ko'ra olmaydi. | Kichik | `receipt_url` (faqat egasiga) qo'shing |
| A6 | `BillingInfo.center` schema'da tiplanmagan obyekt (`additionalProperties: {}`), tuzilishi faqat tavsifda. | Tip xavfsizligi yo'q | Serializer qiling |
| A7 | `Plan.max_teachers` — `integer | null`, `BillingInfo.max_teachers` esa `integer` (null emas). `teacher` tarifida nima qaytishi noma'lum. | Frontend `members.length >= max` da adashishi mumkin | `teacher` uchun `0` yoki `null` ekanini hujjatlang |
| A8 | Muddat qoidasi hujjatlanmagan. Frontend FAQ'da "qolgan kunlar ustiga qo'shiladi" deydi, backend shunday qilishini schema tasdiqlamaydi. `period_days` qiymati ham (30?) faqat `/billing/plans/` javobida. | FAQ yolg'on bo'lib qolishi mumkin | Sinab ko'ring (4-bo'lim, test 6) |
| A9 | Narxlarni (49 000 / 300 000) ko'rolmadim: `/billing/plans/` token talab qiladi. | Backenddagi narx boshqacha bo'lsa UI va haqiqiy narx mos kelmaydi | Frontend narxni **API'dan** olsin (3.2). Backendda tekshiring |

Frontend tomondagi xatolar jadval 1 da (F1–F10).

---

## 3. Yangi oqim

### 3.1 Foydalanuvchi holatlari

`BillingInfo` va `Payment` dan holat (bitta `getPremiumState()` funksiyasida hisoblang):

| Holat | Sharti | UI |
|---|---|---|
| `trial` | `has_access` va `paid_until` yo'q yoki o'tgan | Header: "Sinov · N kun" + "Premiumga o'tish" tugmasi |
| `trial_ending` | `trial`, `left <= 3` | Yuqorida sariq banner |
| `expired` | `!has_access` | Qizil/peach banner + paywall modal (publish'da) |
| `pending` | `pending_payment != null` | Header: "Chek tekshirilmoqda" belgisi, billing sahifada holat kartasi |
| `rejected` | `last_payment.status === "rejected"` va ko'rilmagan | Rad modal: `admin_note` + "Qayta yuborish" |
| `premium` | `has_access` va `paid_until` faol | Header: toj + "N kun", premium kartasi |
| `premium_ending` | `premium`, `left <= 3` | Sariq banner "Uzaytirish" |
| `approved_new` | `last_payment.status === "approved"` va ko'rilmagan | **Tabrik modal + konfetti** |

`superadmin` uchun bannerlar ko'rinmaydi (hozirgidek).

### 3.2 Ma'lumot oqimi

```
useBilling()  ──GET /billing/me/──►  BillingInfo      (queryKey ["billing"])
usePlans()    ──GET /billing/plans/─► narxlar + karta (queryKey ["billing","plans"], staleTime 5 daqiqa)
submitPayment ──POST /billing/payments/ (multipart)──► invalidate ["billing"], ["me"]
```

- `usePlans()` narx va kartani beradi. `lib/plans.ts` faqat matnlar (`title`, `text`, `features`) va **zaxira narx** (49 000 / 300 000) uchun qoladi. Ekranda API narxi ustun.
- `AdminLayout` ichida **bitta** `useBilling()` ishlaydi, `pending_payment` bor bo'lsa `refetchInterval: 15_000`. Qo'shimcha `refetchOnWindowFocus: true`. Shunda foydalanuvchi qaysi sahifada bo'lmasin, tasdiq kelishi bilan bilib oladi.
- Holat o'zgarsa (`pending → approved/rejected`) `["me"]` ni ham invalidate qiling, shunda `has_access` yangilanadi.

### 3.3 To'lov bosqichlari (modal, 3 qadam)

`PayModal` (eski `OnlinePayModal` o'rniga):

1. **Tarif va summa.** Tarif kartalari (teacher/center), tanlangan narx. Markaz bo'lsa "O'quv markaz nomi" maydoni (majburiy, ≤ 150).
2. **O'tkazma.** Katta blok: karta raqami (mono shrift, "Nusxalash" tugmasi), karta egasi, **aniq summa** ("Aynan 49 000 so'm o'tkazing", nusxalash tugmasi bilan). Pastda 1-2-3 mini yo'riqnoma: kartaga o'tkazing → chekni screenshot qiling → keyingi qadamda yuklang.
3. **Chek yuklash.** Drag-and-drop zona + "Rasm tanlash" (telefonda kamera/galereya). Ruxsat: `image/*`, `application/pdf`. Tanlangach preview (rasm miniaturasi yoki PDF nomi + hajmi), "Almashtirish" va "Yuborish" tugmalari. Yuborishda progress.
4. **Yuborildi (yakun).** "Chekingiz qabul qilindi. Odatda ... ichida tekshiriladi" (vaqtni o'zingiz yozing), `pending` kartasiga o'tish tugmasi. Konfetti **bu yerda emas**, faqat tasdiqdan keyin.

Validatsiya (yuborishdan oldin):
- Hajm > 5 MB bo'lsa va rasm bo'lsa, canvas bilan 1600 px gacha kichraytirib JPEG (0.85) qiling. PDF > 5 MB bo'lsa xato: "Fayl 5 MB dan oshmasin".
- Tur rasm yoki PDF emas bo'lsa rad eting.
- `plan=center` va `center_name` bo'sh bo'lsa tugma `disabled`.

`submitPayment`:

```ts
export const submitPayment = (plan: Plan, receipt: File, centerName?: string, onProgress?: (p: number) => void) => {
  const fd = new FormData();
  fd.append("plan", plan);
  fd.append("receipt", receipt);
  if (plan === "center") fd.append("center_name", centerName!.trim());
  return adminApi.post<Payment>("/billing/payments/", fd, {
    onUploadProgress: e => e.total && onProgress?.(e.loaded / e.total),
  }).then(r => r.data);
};
```

`Content-Type` ni qo'lda yozmang (axios chegara `boundary` ni o'zi qo'yadi).

Xatolarni ko'rsatish:

| Holat | Qilinadigan ish |
|---|---|
| `409 PAYMENT_PENDING` | `["billing"]` ni yangilang, modalni yoping, "Sizda tekshirilayotgan chek bor" |
| `400/422` (`center_name`, fayl) | `err.message` ni maydon ostida ko'rsating |
| `413` (proksi chegarasi) | "Fayl juda katta (5 MB gacha)" |
| `401` | interceptor yangilaydi, qo'lda ish yo'q |
| `NETWORK` | "Internet aloqasi yo'q", faylni saqlab turing, qayta urinish tugmasi |

### 3.4 Admin (siz) tomonidan tasdiqlash

Frontendda o'zgarish kerak emas. Django admin'da to'lovni `approved` qilsangiz backend `paid_until` ni uzaytiradi (1 oy), `/billing/me/` va `/auth/me/` yangilanadi. Rad etsangiz `admin_note` ga sabab yozing, o'qituvchiga ko'rinadi.

Agar tasdiqlashni shu frontend ichida (superadmin sahifasida) qilmoqchi bo'lsangiz, backendda `GET /admin/payments/`, `POST /admin/payments/{id}/approve|reject/` kerak. Hozir yo'q. Kerak bo'lsa ayting, alohida spetsifikatsiya yozaman.

---

## 4. Premium UI: "undash" va "doim sezilib turish"

Dizayn tizimini o'zgartirmang: mavjud tokenlar (`gradient-aurora`, `bg-peach`, `text-warning`, `shadow-md`) va `Crown` ikonkasi. `Crown` ni `BillingPage.tsx` dan `components/Crown.tsx` ga chiqaring (hozir 3 joyda nusxa).

### 4.1 Premium yo'q payti (`trial`, `trial_ending`, `expired`)

| Joy | Nima |
|---|---|
| Header | Hozirgi oddiy "Premium" tugmasi o'rniga `gradient-aurora` fonli pill: toj + "Premiumga o'tish". Ohista nafas olish animatsiyasi (`prefers-reduced-motion` ni hisobga oling). |
| Banner (`AdminLayout`) | Hozirgi bannerni saqlang, matnni kuchaytiring: "Sinov muddati N kunda tugaydi. Premium 49 000 so'm dan". Tugma: "Tarifni ko'rish". Yopish (✕) tugmasi, `sessionStorage` da eslab qolinadi. |
| `ExamsPage` | Testlar ro'yxati tepasida yoki bo'sh holatda kompakt "Premium ochilmagan" kartasi: 3 ta ustunlik (cheksiz test, anti-cheat, Excel) + tugma. Premium bo'lsa ko'rinmaydi. |
| Publish paywall (`ExamLayout`) | Oddiy modal o'rniga chiroyli: toj, "Testni nashr qilish uchun Premium kerak", o'qituvchi/markaz mini-kartalari narxi bilan, "Premium olish" (to'g'ridan-to'g'ri `PayModal` ni ochadi) va "Keyinroq". Test qoralama bo'lib qolgani yozilsin. |
| Natijalar sahifasi | "Excel'ga yuklash" tugmasi yonida kichik toj (premium xususiyati ekani). Backend bu yerni bloklamasa, faqat belgi, bloklash emas. |
| `PremiumPage` | "Boshlash" tugmasi to'g'ridan-to'g'ri `PayModal` ni ochadi, FAQ matni P2P ga moslanadi (3.5). |

### 4.2 Premium bor payti (`premium`)

"Butun loyiha bo'ylab premium sezilib tursin" deb tushundim: foydalanuvchi qaysi sahifada bo'lmasin premium ekanini ko'rib, undan foydalanishdan zavqlansin.

| Joy | Nima |
|---|---|
| Header | Toj aurora doira ichida (`ring-2`), yonida "Premium · N kun". `left <= 3` bo'lsa sariq. Bosilsa `/admin/billing`. |
| Logo | Logo yonidagi aurora doira ustiga kichik toj belgisi (rozetka). |
| `PublishModal` | Kod/QR oynasi tepasida "Premium" belgisi (kichik). |
| `ExamsPage` | Tepada ingichka salomlashuv: "Premium faol · N kun qoldi" yoki shunchaki ism yonida badge. |
| Billing sahifasi | Mavjud `PremiumCard` (progress bar) qoladi, to'lov kartasi "Obunani uzaytirish" bo'ladi. |
| Muddat oxirlaganda | 3 kun qolganda banner "Uzaytirish". |

### 4.3 Tabrik (tasdiqlanganda)

`PremiumWatcher` (yangi komponent, `AdminLayout` ichida):

1. `useBilling()` natijasini kuzatadi.
2. `last_payment.status === "approved"` va `last_payment.id` `localStorage["tester.premium.seen"]` ga teng emas bo'lsa va `reviewed_at` oxirgi 7 kun ichida bo'lsa, `CongratsModal` ochadi va `Confetti` otadi.
3. Yopilganda `seen = last_payment.id` yoziladi. Shunda qayta chiqmaydi, brauzer yopilgan bo'lsa ham keyingi kirishda ko'rinadi.
4. Eski to'lovlar (7 kundan oldin) uchun modal chiqmaydi, faqat `seen` jimgina yangilanadi.

`CongratsModal` mazmuni (mavjud `OnlinePayModal` ning `done` qadamidagi dizaynni qayta ishlating): aurora fon, katta toj, "Tabriklaymiz! 🎉", "{Tarif} {sana} gacha faol", imkoniyatlar ro'yxati. Markaz bo'lsa "O'qituvchilarni qo'shish" tugmasi (`/admin/billing`), aks holda "Test yaratish" (`/admin`).

Rad etilganda xuddi shunday `RejectedModal`: "Chekingiz qabul qilinmadi", sabab (`admin_note`, bo'sh bo'lsa umumiy matn), tugmalar "Qayta yuborish" (`PayModal`) va "Yopish". `seenRejected` kaliti alohida.

### 4.4 Matnlar (o'zbekcha, nusxa)

| Joy | Matn |
|---|---|
| Pill (yo'q) | Premiumga o'tish |
| Pill (bor) | Premium · {N} kun |
| Pill (kutilmoqda) | Chek tekshirilmoqda |
| Karta sarlavhasi | Kartaga o'tkazing |
| Summa eslatmasi | Aynan {summa} o'tkazing |
| Yuklash | Chek rasmini yuklang (rasm yoki PDF, 5 MB gacha) |
| Pending | Chekingiz tekshirilmoqda. Tasdiqlangach Premium avtomatik ochiladi. |
| Tabrik | Tabriklaymiz! Premium faollashtirildi |
| Rad | Chekingiz qabul qilinmadi |

### 4.5 Tuzatiladigan eski matnlar

- `PremiumPage` pastki izoh: "Ikkala tarif ham Click yoki Payme..." → "To'lov kartaga o'tkazma orqali, chek tasdiqlangach Premium 30 kunga ochiladi."
- FAQ: "To'lov qanday amalga oshiriladi?" javobi mos (kartaga o'tkazma + chek), "Tasdiqlangach..." vaqtini aniqlashtiring. "Muddat tugamasdan to'lasam" javobini 2.3-A8 tekshiruvidan keyin qoldiring.
- `BillingPage`: "Karta orqali to'lov — darhol tasdiqlanadi" → "Chek odatda ... ichida tekshiriladi".
- `isBillingMock()` ogohlantirish bloki butunlay olib tashlanadi.

---

## 5. Fayllar bo'yicha ish rejasi

| Fayl | Amal |
|---|---|
| `src/api/billingMock.ts` | **O'chirish** |
| `src/components/OnlinePayModal.tsx` | **O'chirish**, o'rniga `PayModal.tsx` |
| `src/api/admin.ts` | `withMock`, `isBillingMock`, `payOnline`, `PayProvider` ni olib tashlash. `getBilling`, `listMembers`, `addMember`, `removeMember` to'g'ridan-to'g'ri `adminApi`. Yangi: `getPlans`, `listPayments`. `submitPayment` ga `centerName`, progress |
| `src/api/types.ts` | `Payment.center_name`, `PlansResponse`, `PlanInfoApi` qo'shish |
| `src/lib/plans.ts` | Markaz narxi 300 000, 49 000 ni zaxira sifatida qoldirish. `features` matnlari qoladi |
| `src/hooks/useBilling.ts` | **Yangi.** `useBilling`, `usePlans`, `getPremiumState` |
| `src/components/Crown.tsx` | **Yangi.** Ikonkani bitta joyga chiqarish |
| `src/components/PayModal.tsx` | **Yangi.** 3.3 dagi qadamlar |
| `src/components/PremiumWatcher.tsx` | **Yangi.** Tabrik va rad modallari, `seen` mantig'i |
| `src/components/PremiumPill.tsx` | **Yangi.** Header belgisi (4 ta holat) |
| `src/components/PaywallModal.tsx` | **Yangi.** `ExamLayout` dagi oddiy modalning o'rniga |
| `src/components/AdminLayout.tsx` | `PremiumPill`, `PremiumWatcher`, banner matni, polling |
| `src/pages/admin/BillingPage.tsx` | `PayCard` ni `PayModal` ga ulash, `pending/rejected` kartalari, mock bloki olib tashlash, `PremiumCard/WelcomeBanner` qoladi |
| `src/pages/admin/PremiumPage.tsx` | "Boshlash" → `PayModal`, matnlar |
| `src/pages/admin/ExamLayout.tsx` | `paywall` modalini `PaywallModal` ga almashtirish. `err.code.toUpperCase()` bilan tekshirish |
| `src/pages/admin/ExamsPage.tsx` | Premium yo'q bo'lsa upsell kartasi |

`npm run build` (`tsc -b`) `noUnusedLocals` ni talab qiladi, shuning uchun mock'ni o'chirgach importlar ham tozalansin.

---

## 6. Qabul testi (tekshiruv ro'yxati)

Test uchun akkaunt kerak (Google), Django admin'ga kirish huquqi bilan.

1. Yangi akkaunt: header "Premiumga o'tish", sinov banneri ko'rinadi.
2. Sinov tugagan akkaunt: Publish bosilsa chiroyli paywall chiqadi, "Premium olish" `PayModal` ni ochadi.
3. `teacher`: karta va 49 000 ko'rinadi, rasm yuklanadi, `pending` bo'ladi. Server `201` qaytaradi (Network panelda tekshiring, `localStorage` emas).
4. `center`: nom bo'sh bo'lsa "Yuborish" o'chiq. Nom bilan 300 000 yuboriladi.
5. `pending` payti qayta yuborib ko'ring: `409 PAYMENT_PENDING` to'g'ri ko'rsatiladi. Sahifani yangilang, `pending` holati saqlanadi.
6. Django admin'da `approved` qiling. 15 s ichida (yoki oynaga qaytganda) tabrik + konfetti chiqadi, header "Premium · 30 kun". **Muddatni tekshiring:** qolgan kunlar ustiga qo'shiladimi (A8).
7. Tabrikni yoping, sahifani yangilang: qayta chiqmaydi.
8. Rad etib ko'ring (`admin_note` bilan): `RejectedModal` sababni ko'rsatadi, "Qayta yuborish" ishlaydi.
9. Premium akkaunt: Publish ishlaydi, `has_access` true.
10. 5 MB dan katta rasm avtomatik kichrayadi, katta PDF xato beradi.
11. Telefon (≈380 px): modal, drag-drop o'rniga tugma, karta nusxalash ishlaydi.
12. `npm run build` xatosiz o'tadi, `grep -r billingMock src` bo'sh.

---

## 7. Ochiq savollar

1. Tasdiqlashni faqat Django admin'da qilasizmi, yoki frontendda ham superadmin sahifasi kerakmi? (3.4)
2. "Ishlatgan sari ishlatishni xohlayman" gapini 4.2 dagidek (premium doim sezilib tursin) tushundim. Boshqacha nazarda tutgan bo'lsangiz ayting (masalan, foydalanish statistikasi: nechta test, qancha ishtirokchi).
3. Chek tekshirish vaqti uchun matn ("odatda ... ichida"): qancha yozamiz?
4. Backenddagi haqiqiy narxlar 49 000 / 300 000 ekanini tasdiqlang (A9).
