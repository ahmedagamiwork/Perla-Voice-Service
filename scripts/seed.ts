import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { pool } from '../src/db/pool.js';
import { normalizeArabic } from '../src/utils/arabic.js';

type Catalog = { products: Array<{product_code:string;name_ar:string;price_sar:number;unit_code:string;unit_ar:string;category_ar:string;aliases_ar:string[];pronunciation_hint?:string|null;is_active:boolean;source:string}> };

async function main() {
  const catalogText = await fs.readFile('data/catalog.json','utf8');
  const catalog: Catalog & { catalog_version?: string } = JSON.parse(catalogText);
  const catalogHash = crypto.createHash('sha256').update(catalogText).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const branches = [
      { code:'ALKHARJ', name:'فرع الخرج', pronunciation:'الخَرْج', city:'الخرج' },
      { code:'DILAM', name:'فرع الدلم', pronunciation:'اِدْ دِلَم', city:'الدلم' }
    ];
    for (const b of branches) {
      await client.query({
        text:`INSERT INTO branches(code,name_ar,normalized_name_ar,voice_pronunciation,city_ar)
              VALUES($1,$2,$3,$4,$5)
              ON CONFLICT(code) DO UPDATE SET name_ar=EXCLUDED.name_ar, normalized_name_ar=EXCLUDED.normalized_name_ar,
                voice_pronunciation=COALESCE(branches.voice_pronunciation,EXCLUDED.voice_pronunciation), city_ar=EXCLUDED.city_ar`,
        values:[b.code,b.name,normalizeArabic(b.name),b.pronunciation,b.city]
      });
    }

    const categories = [...new Set(catalog.products.map(p=>p.category_ar))];
    for (const [index,name] of categories.entries()) {
      await client.query({
        text:`INSERT INTO categories(name_ar,normalized_name_ar,sort_order) VALUES($1,$2,$3)
              ON CONFLICT(name_ar) DO UPDATE SET normalized_name_ar=EXCLUDED.normalized_name_ar, sort_order=EXCLUDED.sort_order`,
        values:[name,normalizeArabic(name),index]
      });
    }

    for (const p of catalog.products) {
      const result = await client.query({
        text:`INSERT INTO products(product_code,name_ar,normalized_name_ar,category_id,price_sar,unit_code,unit_ar,pronunciation_hint,is_active,source_name,source_updated_at)
              SELECT $1,$2,$3,c.id,$5,$6,$7,$8,$9,$10,NOW() FROM categories c WHERE c.name_ar=$4
              ON CONFLICT(product_code) DO UPDATE SET
                name_ar=EXCLUDED.name_ar, normalized_name_ar=EXCLUDED.normalized_name_ar,
                category_id=EXCLUDED.category_id, price_sar=EXCLUDED.price_sar, unit_code=EXCLUDED.unit_code,
                unit_ar=EXCLUDED.unit_ar, is_active=EXCLUDED.is_active, source_name=EXCLUDED.source_name,
                source_updated_at=NOW()
              RETURNING id`,
        values:[p.product_code,p.name_ar,normalizeArabic(p.name_ar),p.category_ar,p.price_sar,p.unit_code,p.unit_ar,p.pronunciation_hint??null,p.is_active,p.source]
      });
      const productId=result.rows[0].id;
      for (const alias of p.aliases_ar) {
        await client.query({
          text:`INSERT INTO product_aliases(product_id,alias_ar,normalized_alias_ar)
                VALUES($1,$2,$3) ON CONFLICT(product_id,normalized_alias_ar) DO UPDATE SET alias_ar=EXCLUDED.alias_ar`,
          values:[productId,alias,normalizeArabic(alias)]
        });
      }
    }

    await client.query(`
      INSERT INTO branch_product_availability(branch_id,product_id,availability_status)
      SELECT b.id,p.id,'unknown' FROM branches b CROSS JOIN products p
      ON CONFLICT(branch_id,product_id) DO NOTHING
    `);

    await client.query({
      text: `INSERT INTO public_links(link_key,title_ar,url,link_type,sort_order)
             VALUES($1,$2,$3,$4,$5)
             ON CONFLICT(link_key) DO UPDATE SET
               title_ar=EXCLUDED.title_ar,
               url=EXCLUDED.url,
               link_type=EXCLUDED.link_type,
               sort_order=EXCLUDED.sort_order,
               is_active=TRUE,
               updated_at=NOW()`,
      values:['official_hub','الرابط الرسمي الموحد لبيرلا','https://beacons.ai/perlapastry','official_hub',0]
    });

    const policies = [
      ['pricing','سياسة الأسعار','الأسعار الواردة في الكتالوج موحدة بين فرعي الخرج والدلم، وتُعرض بالريال السعودي.'],
      ['availability','سياسة التوفر','السعر مؤكد من الكتالوج، أما توفر المنتج في الفرع فلا يُؤكد إلا إذا كانت حالة التوفر مسجلة كمتاح.'],
      ['order_confirmation','تأكيد الطلب','أي طلب ينشئه المساعد الصوتي هو مسودة فقط، ولا يصبح طلبًا مؤكدًا إلا بعد مراجعة موظف بيرلا للمنتجات والموعد والتوصيل.'],
      ['payment_safety','سلامة الدفع','لا يطلب المساعد الصوتي بيانات البطاقة البنكية الكاملة أو رمز التحقق.']
    ];
    for (const [key,title,content] of policies) {
      await client.query({
        text:`INSERT INTO business_policies(policy_key,title_ar,content_ar) VALUES($1,$2,$3)
              ON CONFLICT(policy_key) DO UPDATE SET title_ar=EXCLUDED.title_ar,content_ar=EXCLUDED.content_ar,updated_at=NOW()`,
        values:[key,title,content]
      });
    }

    await client.query({
      text: `INSERT INTO catalog_imports(source_name,source_sha256,catalog_version,product_count)
             VALUES($1,$2,$3,$4) ON CONFLICT(source_sha256) DO NOTHING`,
      values:['data/catalog.json',catalogHash,catalog.catalog_version??null,catalog.products.length]
    });

    await client.query('COMMIT');
    console.log(`seeded ${catalog.products.length} products with unified prices; catalog sha256=${catalogHash}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>pool.end());
