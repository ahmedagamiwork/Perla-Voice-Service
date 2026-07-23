import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const catalog = JSON.parse(fs.readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8')) as {prices_unified_across_branches:boolean;products:Array<{product_code:string;name_ar:string;price_sar:number;aliases_ar:string[]}>};

test('catalog has 85 unique products with positive prices', () => {
  assert.equal(catalog.products.length, 85);
  assert.equal(new Set(catalog.products.map(p => p.product_code)).size, 85);
  assert.ok(catalog.products.every(p => p.price_sar > 0));
  assert.equal(catalog.prices_unified_across_branches, true);
});

test('key official prices match supplied spreadsheet', () => {
  const byCode = new Map(catalog.products.map(p => [p.product_code, p]));
  assert.equal(byCode.get('1000012')?.name_ar, 'عش البلبل / مبرومة');
  assert.equal(byCode.get('1000012')?.price_sar, 130);
  assert.equal(byCode.get('1000043')?.price_sar, 85);
  assert.equal(byCode.get('1000079')?.name_ar, 'توصيل');
  assert.equal(byCode.get('1000079')?.price_sar, 20);
});

test('voice aliases include common variants', () => {
  const product = catalog.products.find(p => p.product_code === '1000012');
  assert.ok(product?.aliases_ar.includes('عش البلبل'));
  assert.ok(product?.aliases_ar.includes('المبرومة'));
});
