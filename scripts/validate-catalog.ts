import fs from 'node:fs/promises';
import { normalizeArabic } from '../src/utils/arabic.js';

const catalog = JSON.parse(await fs.readFile('data/catalog.json','utf8')) as {products:Array<Record<string,unknown>>};
const errors:string[]=[];
const codes=new Set<string>();
for(const [i,p] of catalog.products.entries()){
  const prefix=`products[${i}]`;
  const code=String(p.product_code??'');
  if(!code)errors.push(`${prefix}: missing product_code`);
  if(codes.has(code))errors.push(`${prefix}: duplicate code ${code}`);codes.add(code);
  if(!String(p.name_ar??'').trim())errors.push(`${prefix}: missing name`);
  if(!(Number(p.price_sar)>0))errors.push(`${prefix}: price must be > 0`);
  if(!String(p.unit_code??''))errors.push(`${prefix}: missing unit_code`);
  const aliases=(p.aliases_ar as string[]|undefined)??[];
  if(!aliases.length)errors.push(`${prefix}: missing aliases`);
  if(!normalizeArabic(String(p.name_ar??'')))errors.push(`${prefix}: name normalizes to empty`);
}
if(catalog.products.length!==85)errors.push(`expected 85 products, got ${catalog.products.length}`);
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`catalog valid: ${catalog.products.length} products, ${codes.size} unique codes`);
