# نشر المشروع على Railway

## 1. مشروع مستقل

أنشئ Service جديدًا لهذا المشروع. لا تضعه داخل Service تطبيق الطلبيات.

## 2. قاعدة بيانات مستقلة

أضف PostgreSQL جديدة خاصة بخدمة العملاء الصوتية. اربط متغير `DATABASE_URL` بها فقط.

## 3. متغيرات البيئة

```text
NODE_ENV=production
PORT=3000
DATABASE_URL=<Railway PostgreSQL URL>
DATABASE_SSL=false
VOICE_API_TOKEN=<48-byte random hex or longer>
ADMIN_API_TOKEN=<different random token>
PII_ENCRYPTION_KEY=<exactly 64 hex characters>
PUBLIC_BASE_URL=https://YOUR-SERVICE.up.railway.app
ENABLE_WRITE_TOOLS=false
LOG_LEVEL=info
ALLOWED_ORIGINS=https://YOUR-SERVICE.up.railway.app
```

## 4. أول نشر

بعد اكتمال الـBuild شغّل في Railway Shell:

```bash
npm run migrate
npm run catalog:validate
npm run seed
```

الأوامر Idempotent: يمكن إعادة تشغيلها لتحديث الكتالوج دون تكرار المنتجات.

## 5. اختبارات حية

```bash
curl https://YOUR-SERVICE.up.railway.app/health
```

اختبار REST:

```bash
curl -H "Authorization: Bearer $VOICE_API_TOKEN" \
  "https://YOUR-SERVICE.up.railway.app/api/v1/voice/products/search?q=عش%20البلبل"
```

يجب أن يرجع السعر 130 ريالًا.

## 6. لوحة الإدارة

```text
https://YOUR-SERVICE.up.railway.app/admin
```

استخدم `ADMIN_API_TOKEN`، ولا تشاركه مع xAI.

## 7. إطلاق تدريجي

1. اربط أدوات القراءة فقط.
2. اختبر 30 سيناريو مكالمة.
3. حدّث بيانات الفروع والتوفر والسياسات.
4. فعّل أدوات الكتابة في بيئة تجريبية.
5. اختبر مسودات الطلب والمتابعة.
6. بعد ذلك فقط اربط رقم الهاتف الحقيقي.
