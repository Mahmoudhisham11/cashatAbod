# Cashat Abod

نظام إدارة كاشات ومحافظ إلكترونية مبني بـ Next.js + Firebase لإدارة:
- عمليات الإرسال والاستلام اليومية.
- الأرقام والليمت اليومي/الشهري لكل خط.
- الديون (ليك/عليك) مع سداد جزئي أو كامل.
- التقارير والتصدير Excel.
- صلاحيات المستخدمين والتفعيلات.

التطبيق موجه لواجهة عربية RTL بالكامل، ويدعم Light / Dark Mode.

## التقنية المستخدمة

- `Next.js 16` (App Router)
- `React 19`
- `Firebase Firestore`
- `next-pwa` (Service Worker + Manifest)
- `react-icons`
- `xlsx` + `file-saver` (تصدير التقارير)
- `react-qr-code`
- `emailjs-com` (OTP لاسترجاع كلمة المرور)

## متطلبات التشغيل

- `Node.js >= 22`
- `npm` (أو أي مدير حزم متوافق)

## تشغيل المشروع محليًا

```bash
npm install
npm run dev
```

ثم افتح:
- [http://localhost:3000](http://localhost:3000)

### أوامر المشروع

- `npm run dev` تشغيل التطوير
- `npm run build` بناء الإنتاج
- `npm run start` تشغيل نسخة الإنتاج
- `npm run lint` فحص ESLint

## هيكل المشروع

```text
app/
  layout.jsx
  globals.css
  firebase.jsx
  page.jsx
  Numbers/page.jsx
  debts/page.jsx
  reports/page.jsx
  sittings/page.jsx
components/
  Login/
  Main/
  Nav/
  Wallet/
  Cash/
  CashPop/
  Developer/
public/
  manifest.json
  sw.js
  workbox-*.js
```

## مسارات الصفحات

- `/` الصفحة الرئيسية:
  - لو المستخدم مسجل دخول (email موجود في `localStorage`) يفتح `Main`.
  - غير كده يفتح `Login`.
- `/Numbers` إدارة الخطوط والليمت + QR + تعديل/حذف.
- `/debts` إدارة الديون وإجراءات السداد والتصدير.
- `/reports` تقارير العمليات مع فلترة وحذف وتصدير.
- `/sittings` الإعدادات، الصلاحيات، التفعيلات، النقدي، الأرباح اليدوية.

## منطق البيانات (Firestore)

المجموعات الأساسية المستخدمة:

- `users`
  - بيانات تسجيل الدخول: `name`, `email`, `password`.
  - التفعيل: `isSubscribe`.
  - الصلاحيات:  
    `lockReports`, `lockNumbers`, `lockMoney`, `lockCash`, `lockDaily`, `lockSettings`, `lockDebts`.

- `numbers`
  - بيانات الخط/المحفظة: `phone`, `name`, `idNumber`, `amount`.
  - الليمت:
    - `withdrawLimit`, `depositLimit`
    - `originalWithdrawLimit`, `originalDepositLimit`
    - `dailyWithdraw`, `dailyDeposit`
  - يتم إعادة ضبط اليومي والشهري تلقائيًا داخل صفحة `Numbers`.

- `cash`
  - قيمة الرصيد النقدي: `cashVal`.
  - يتم التعديل عليه تلقائيًا مع عمليات الإرسال/الاستلام/الديون.

- `operations`
  - العمليات اليومية (قبل تقفيل اليوم).
  - الحقول الشائعة: `type`, `phone`, `operationVal`, `commation`, `notes`, `receiver`, `createdAt`, `userName`.

- `reports`
  - أرشيف العمليات بعد "تقفيل اليوم" + أرباح يدوية + تصدير تقارير.
  - قد يحتوي `createdAt` أو `date` حسب مصدر السجل.

- `debts`
  - إدارة ديون العملاء: `clientName`, `amount`, `debtType`, `status`, `payMethod`, `walletId`, `walletPhone`, `date`, `userEmail`, `userName`.

## نظام الـ Style في المشروع (بالظبط كما هو)

المشروع يعتمد على:
- `app/globals.css` كـ Global Design System.
- `CSS Modules` لكل صفحة/مكون (`*.module.css`).
- اتجاه عربي `RTL`.
- خط أساسي `Cairo`.
- ثيم فاتح/غامق عن طريق تبديل class على `body` بين `light` و `dark`.

### 1) Global Reset + Direction

- `*`:
  - `padding: 0`
  - `margin: 0`
  - `box-sizing: border-box`
  - `font-family: "cairo"`
- `body`:
  - `direction: rtl`
  - `background-color: var(--background)`
  - `color: var(--text-color)`
  - transition ناعم بين الثيمات.

### 2) CSS Variables (Design Tokens)

في `:root`:
- `--main-color: #395fe4`
- `--gray-color: white`
- `--black-color: #1b1b1b`
- `--bg-light: #f4f4f4`
- `--bg-dark: #121212`
- `--background: var(--bg-light)`
- `--nav-color: #f4f4f4`
- `--text-color: #1a1a1a`
- `--secondary-text: rgba(0, 0, 0, 0.6)`
- `--card-bg: #1a1a1a`
- `--card-text: #ffffff`

عند `body.dark`:
- `--background: var(--bg-dark)`
- `--text-color: #f5f5f5`
- `--secondary-text: rgba(255, 255, 255, 0.6)`
- `--card-bg: #f5f5f5`
- `--card-text: #1a1a1a`
- `--gray-color: #2c2c2c`
- `--nav-color: #1a1a1a`

### 3) المكونات العالمية المشتركة في `globals.css`

- `header` موحد بارتفاع `80px` وحواف سفلية دائرية.
- `headerLink` زر رجوع ثابت يسار الهيدر.
- `inputContainer` / `amounts` لتنسيق عناصر الإدخال.
- `operationContainer` و `operationContainer.active` لفتح/غلق لوحات العمليات الجانبية.
- `operationBtn` زر الإجراء الأساسي.
- `shadowBox` / `box` للـ overlays.
- جدول موحد:
  - `table`, `th`, `td`, `thead sticky`.
- دعم `@media print` لإخفاء الهيدر وقت الطباعة.

### 4) CSS Modules المستخدمة

لكل Feature ملف style خاص:
- `components/Login/styles.module.css`
- `components/Main/styles.module.css`
- `components/Nav/style.module.css`
- `components/Wallet/styles.module.css`
- `components/Cash/styles.module.css`
- `components/CashPop/styles.module.css`
- `components/Developer/styles.module.css`
- `app/Numbers/styles.module.css`
- `app/debts/styles.module.css`
- `app/reports/styles.module.css`
- `app/sittings/styles.module.css`

ده معناه إن الـ layout العام والألوان من `globals.css`، لكن تفاصيل كل شاشة (spacing/cards/buttons/popups) متقسمة module-by-module.

## ملاحظات مهمة

- إعدادات Firebase موجودة حاليًا مباشرة داخل `app/firebase.jsx`.
- تسجيل الدخول الحالي قائم على Firestore + `localStorage` (بدون Firebase Auth SDK).
- بيانات حساسة مثل مفاتيح EmailJS موجودة داخل الكود.
- المشروع مفعّل كـ PWA من خلال `next-pwa` وملفات `manifest.json` + `sw.js`.

## إعدادات PWA

في `next.config.js`:
- `next-pwa` مفعل مع:
  - `dest: "public"`
  - `register: true`
  - `skipWaiting: true`
- والسماح بـ remote images من:
  - `https://firebasestorage.googleapis.com`

## تحسينات مقترحة مستقبلًا

- نقل المفاتيح الحساسة إلى متغيرات بيئة `.env.local`.
- استخدام Firebase Authentication بدل التوثيق اليدوي.
- إضافة Validation أقوى ورسائل أخطاء موحدة.
- إضافة اختبارات (unit/integration) للعمليات المالية الحساسة.
