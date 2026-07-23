# إعداد xAI Voice Agent

## MCP Tool

داخل تبويب Tools اختر MCP ثم أدخل:

```text
Server URL:
https://YOUR-SERVICE.up.railway.app/mcp

Server Label:
perla_customer_service

Server Description:
Official Perla Pastry customer-service catalog with unified prices for Al Kharj and Al Dilam, branch information, approved policies, and optional human follow-up or order-draft tools.

Authorization:
Bearer <VOICE_API_TOKEN>
```

## الأدوات المسموحة في أول إطلاق

```text
search_products
get_product
list_categories
list_branches
get_branch
get_business_policy
get_official_links
```

لا تضف أدوات الكتابة في أول اختبار.

بعد نجاح الاختبارات وتفعيل `ENABLE_WRITE_TOOLS=true` يمكن إضافة:

```text
create_service_request
create_order_draft
```

## قواعد مهمة

- السعر موحد للخرج والدلم.
- التوفر ليس موحدًا ولا يُفترض؛ عندما تكون الحالة `unknown` يجب إبلاغ العميل أن التوفر يحتاج تأكيدًا.
- لا يتصل الوكيل بقاعدة PostgreSQL مباشرة.
- لا تستخدم JWT أو Passcode من تطبيق الطلبيات.


## أداة الروابط الرسمية

أضف `get_official_links` إلى الأدوات المسموح بها. تستخدم هذه الأداة الرابط الرسمي الموحد:

`https://beacons.ai/perlapastry`

لا تجعل الوكيل يذكر اسم حساب اجتماعي أو رقم تواصل إلا إذا أعادته الأداة أو كانت البيانات مسجلة في قاعدة البيانات.
