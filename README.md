# Perla Voice Service — نظام بيرلا المستقل للرد الصوتي

هذا المشروع **مستقل تمامًا عن تطبيق الطلبيات الداخلي**. تطبيق الطلبيات مخصص لطلبات الفروع من المصنع أو المستودع، ولا يحتوي على أسعار بيع العملاء. أما هذا المشروع فهو قاعدة بيانات وخدمة API وRemote MCP لخدمة العملاء والمكالمات الصوتية.

## ما يتضمنه المشروع

- قاعدة PostgreSQL مستقلة.
- كتالوج رسمي مبدئي يحتوي على **85 منتجًا** من ملف Excel المرسل.
- الأسعار بالريال السعودي وموحدة بين فرعي الخرج والدلم.
- بحث عربي يدعم الأسماء البديلة واختلافات الكتابة.
- Remote MCP لربط xAI Voice Agent.
- REST API للاختبار والربط مستقبلًا مع واتساب وإنستجرام.
- لوحة إدارة بسيطة لتحديث الأسعار والأسماء وبيانات الفروع.
- سجل تدقيق لكل أداة يستخدمها الوكيل.
- تشفير بيانات العميل الحساسة داخل قاعدة البيانات.
- طلبات متابعة ومسودات طلب منفصلة عن نظام الطلبيات الداخلي.

## المعمارية

```text
xAI Voice Agent
       │  Bearer Token
       ▼
Remote MCP: /mcp
       │
       ▼
Perla Voice Service
       │
       ▼
PostgreSQL مستقلة خاصة بخدمة العملاء
```

لا يحصل xAI على اتصال مباشر بقاعدة البيانات، ولا يستخدم حسابًا أو رمز دخول من تطبيق الطلبيات.

## البيانات المعتمدة

المصدر الأولي:

```text
data/source-products.xlsx
```

والكتالوج المنظف المستخدم في الـSeed:

```text
data/catalog.json
```

الأسعار موحدة بين الفرعين. **توفر المنتجات لم يُفترض تلقائيًا**؛ حالة التوفر تبدأ `unknown` حتى يتم تحديثها. وبذلك يستطيع الوكيل قول السعر، لكنه لا يعد العميل بتوفر المنتج دون بيانات فعلية.

## الأدوات المتاحة للوكيل

### قراءة — مفعلة دائمًا

- `search_products`
- `get_product`
- `list_categories`
- `list_branches`
- `get_branch`
- `get_business_policy`

### كتابة آمنة — معطلة افتراضيًا

- `create_service_request`
- `create_order_draft`

لتفعيلها:

```env
ENABLE_WRITE_TOOLS=true
```

مسودة الطلب لا تُعد طلبًا مؤكدًا، ولا تؤثر في تطبيق الطلبيات أو المخزون.

## تشغيل محلي

1. انسخ ملف البيئة:

```bash
cp .env.example .env
```

2. ولّد القيم السرية:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

استخدم القيم بالترتيب في:

- `VOICE_API_TOKEN`
- `ADMIN_API_TOKEN`
- `PII_ENCRYPTION_KEY`

3. شغّل PostgreSQL:

```bash
docker compose up -d db
```

4. ثبّت وشغّل:

```bash
npm install
npm run migrate
npm run seed
npm run catalog:validate
npm test
npm run dev
```

5. افتح:

```text
http://localhost:3000/admin
```

## النشر على Railway

راجع الملف:

```text
docs/DEPLOYMENT_RAILWAY_AR.md
```

## ربط xAI

راجع:

```text
docs/XAI_CONFIGURATION_AR.md
docs/XAI_AGENT_INSTRUCTIONS_AR.md
```

بعد النشر يكون رابط MCP:

```text
https://YOUR-SERVICE.up.railway.app/mcp
```

ويتم وضع:

```text
Authorization: Bearer <VOICE_API_TOKEN>
```

## نقاط يجب استكمالها إداريًا

لم تُرسل حتى الآن بيانات موثقة عن:

- أرقام الفرعين.
- عناوين ومواقع Google Maps.
- أوقات العمل.
- أرقام التحويل البشري.
- توفر كل منتج في كل فرع.
- مكونات المنتجات ومسببات الحساسية.
- سياسة العربون والتوصيل والإلغاء.

لذلك لم أخترع هذه المعلومات. يمكن إدخالها من لوحة الإدارة أو API بعد اعتمادها.

## أوامر تحديث الكتالوج

استخراج ملف Excel جديد للمراجعة:

```bash
npm run catalog:import -- --file=/path/to/products.xlsx
```

هذا الأمر لا يعدّل قاعدة البيانات تلقائيًا. بعد مراجعة `data/catalog-import-raw.json` يتم تحديث `data/catalog.json` ثم:

```bash
npm run catalog:validate
npm run seed
```

## سياسة الأمان

- لا تحفظ رموز الدخول في المستودع.
- لا تستخدم نفس Token للإدارة والوكيل.
- لا تسجل أرقام العملاء أو أسماءهم في Logs.
- حافظ على `ENABLE_WRITE_TOOLS=false` حتى نجاح اختبارات القراءة.
- غيّر `PII_ENCRYPTION_KEY` فقط ضمن خطة ترحيل، لأن تغييره يفقد القدرة على فك البيانات القديمة.

## الرابط الرسمي الموحد

تم اعتماد الرابط التالي داخل قاعدة البيانات كالرابط الرسمي الموحد لبيرلا:

- https://beacons.ai/perlapastry

يتاح الرابط للوكيل الصوتي من خلال أداة MCP باسم `get_official_links`، ومن خلال REST API:

```http
GET /api/v1/voice/links?type=official_hub
```

لا يفترض النظام محتوى أو حسابات داخل الصفحة؛ يتم تخزين الرابط نفسه كمصدر رسمي، ويمكن إضافة روابط واتساب وإنستغرام وتيك توك وسناب وخرائط الفروع لاحقًا كسجلات مستقلة.
