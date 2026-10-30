# Claude Code Task: Feedback funksiyasini frontendga integratsiya qilish

## Loyiha haqida

Backend API hujjatlari:
- Swagger / API docs: https://tester-backend.duckdns.org/api/docs
- Django Admin: https://tester-backend.duckdns.org/admin/

Backendda feedback uchun API qo‘shilgan. Endi mavjud frontendga feedback yig‘ish jarayonini integratsiya qilish kerak. Feedback yuborilgan ma’lumotlar backendda saqlanishi va Django Admin panelida ko‘rinishi kerak.

## Asosiy maqsad

Foydalanuvchi **birinchi testni yakunlaganidan keyin** undan feedback so‘raladigan interfeys ko‘rsatilsin. Foydalanuvchi:
- 1–5 yulduz orqali baho bera olsin;
- ixtiyoriy izoh yozsin;
- feedback yuborishni istamasa, **Skip / O‘tkazib yuborish** tugmasini bosa olsin.

Feedback formasi foydalanuvchining test natijasini yo‘qotmasligi va test jarayoniga xalaqit bermasligi kerak.

## Ishni boshlashdan oldin

1. Frontend loyihasining tuzilishini va ishlatilayotgan frameworkni o‘rgan.
2. Test yaratish, testni boshlash va test natijasi ko‘rsatiladigan oqimni top.
3. Backend API docs sahifasini tekshir: `https://tester-backend.duckdns.org/api/docs`.
4. Feedback endpointining aniq:
   - HTTP method va URL;
   - request body maydonlari;
   - response formati;
   - authentication talablari;
   - validatsiya qoidalari
   ni aniqlab ol.
5. Mavjud API client, token/auth mexanizmi va UI komponentlaridan foydalan.
6. Endpoint yoki request formatini taxmin qilma. Hujjatlardan aniqlanmasa, implementatsiyani to‘xtatib, menga aynan qaysi ma’lumot yetishmayotganini ayt.

## Kerakli foydalanuvchi oqimi

1. Foydalanuvchi testni odatdagidek bajaradi.
2. Test muvaffaqiyatli yakunlanib, natija saqlangandan yoki natija sahifasi ko‘rsatilgandan keyin feedback formasi ochiladi.
3. Formada 1 dan 5 gacha yulduzli rating bo‘ladi.
4. Foydalanuvchi izoh yozishi mumkin. Izoh majburiy yoki ixtiyoriy ekanini backend validatsiyasi va API docs asosida belgila.
5. **Yuborish (Submit)** tugmasi feedbackni backend API’ga yuboradi.
6. **Skip / O‘tkazib yuborish** tugmasi formani yopadi va foydalanuvchiga test natijasidan foydalanishda davom etish imkonini beradi.
7. Feedback muvaffaqiyatli yuborilganda tushunarli success holatini ko‘rsat va formani yop.
8. So‘rov muvaffaqiyatsiz bo‘lsa, foydalanuvchiga xatoni tushunarli ko‘rsat, yozilgan matn va tanlangan yulduzlarni saqlab qol hamda qayta yuborish imkonini ber.

## UI/UX talablari

- Loyiha dizayniga mos, sodda va zamonaviy modal yoki dialog yarat.
- Sarlavha misoli: **“Test sizga yoqdimi?”** yoki **“Fikringiz biz uchun muhim”**.
- 1–5 yulduzli rating interaktiv bo‘lsin:
  - hover/focus holatlari mavjud bo‘lsin;
  - tanlangan rating aniq ko‘rinsin;
  - klaviatura va accessibility holatlarini imkon qadar hisobga ol.
- Izoh uchun textarea bo‘lsin.
- Submit va Skip tugmalari aniq ajralib tursin.
- Yuborish vaqtida loading holatini ko‘rsat va takroriy submitni oldini ol.
- Mobil va desktop ekranlarda to‘g‘ri ishlasin.
- Modal ochilganda test natijasi yoki boshqa muhim kontent yo‘qolmasin.
- Skip bosilganda feedback API’ga so‘rov yuborilmasin, agar backendda skip uchun alohida endpoint borligi hujjatlarda ko‘rsatilmagan bo‘lsa.

## Qachon ko‘rsatish kerak?

- Feedback formasi **foydalanuvchi birinchi testni muvaffaqiyatli yakunlagandan keyin** ko‘rsatilsin.
- Testni boshlashdan oldin ko‘rsatilmasin.
- Test muvaffaqiyatsiz yakunlansa yoki natija backendda saqlanmagan bo‘lsa, muvaffaqiyatli yakunlangan deb hisoblama.
- Sahifani yangilash yoki qayta ochish sababli feedback formasi kutilmaganda qayta-qayta ochilib ketmasin.
- Agar backendda test yakunlanganini yoki feedback yuborilganini aniqlash uchun kerakli ma’lumotlar mavjud bo‘lsa, ulardan foydalan. Faqat frontend state’iga tayanib, ishonchsiz urinish hisoblagichi yaratma.
- Agar birinchi testdan keyingi ko‘rsatish holatini ishonchli aniqlash uchun backenddan qo‘shimcha ma’lumot kerak bo‘lsa, buni menga ayt; backend kontraktini o‘zingcha o‘zgartirma.

## Backend integratsiyasi

- API base URL va endpointni loyihadagi mavjud konfiguratsiyaga mos ravishda ishlat.
- Authentication talab qilinsa, mavjud auth mexanizmini qayta ishlat.
- Request body’ni faqat API docs’da tasdiqlangan maydonlar bilan yubor.
- Rating va izohni backend kutayotgan formatda jo‘nat.
- Feedback natijasi backendda saqlanishi kerak. Django Admin panelida ko‘rinishi backend modeli/admin konfiguratsiyasiga bog‘liq; frontenddan admin panelni bevosita o‘zgartirishga urinma.
- Admin paneldagi natijalar ko‘rinishini tekshirish uchun kerakli model yoki admin ro‘yxati backendda mavjudligini aniqlash zarur bo‘lsa, mavjud imkoniyatni tekshir va backendda yetishmayotgan qismni aniq ko‘rsat.
- Frontendga admin credential yoki maxfiy kalitlarni joylashtirma.

## Xatolik va edge-case’lar

Quyidagilarni ko‘rib chiq:
- API timeout yoki server xatosi;
- internet uzilishi;
- noto‘g‘ri yoki yetishmayotgan rating;
- izoh uzunligi bo‘yicha backend validatsiyasi;
- foydalanuvchi submit tugmasini bir necha marta bosishi;
- Skip bosilishi;
- test natijasi saqlanmasdan feedback formasi ochilishi;
- authentication muddati tugashi.

## Test va tekshiruv

Implementatsiyadan keyin:
1. Birinchi test muvaffaqiyatli tugaganda feedback formasi chiqishini tekshir.
2. Rating tanlash va izoh kiritishni tekshir.
3. Feedback yuborilganda backend API javobini tekshir.
4. Xatolik holatida forma va foydalanuvchi kiritgan ma’lumotlar saqlanishini tekshir.
5. Skip ishlashini tekshir.
6. Test natijasi yo‘qolmasligini tekshir.
7. Takroriy submit bo‘lmasligini tekshir.
8. Mavjud test oqimi va boshqa funksiyalar buzilmaganini tekshir.

Agar imkon bo‘lsa, tegishli unit yoki integration testlarni ham qo‘sh.

## Ish tartibi va yakuniy hisobot

1. Avval kodni o‘rgan va qisqa reja tuz.
2. So‘ng minimal va maqsadli o‘zgarishlarni kirit.
3. Tegishli testlarni ishga tushir.
4. Yakunda menga quyidagilarni yoz:
   - qaysi fayllar o‘zgargani;
   - feedback endpointi va request formati qanday aniqlangani;
   - rating, izoh va Skip qanday ishlashi;
   - qanday testlar bajarilgani va natijalari;
   - agar Django Admin’da natijalar ko‘rinishi uchun backendda qo‘shimcha ish kerak bo‘lsa, aynan nima yetishmayotgani.

**Muhim:** mavjud kodni tekshirmasdan yangi arxitektura yaratma, endpointlarni taxmin qilma va test ishlash jarayonini buzma.
