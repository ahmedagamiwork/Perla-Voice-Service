import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArabic, searchTokens } from '../src/utils/arabic.js';

test('normalizes Arabic spelling and diacritics', () => {
  assert.equal(normalizeArabic('إِدْ دِلَم'), 'اد دلم');
  assert.equal(normalizeArabic('تورتة 20 × 30'), 'تورته 20 x 30');
  assert.equal(normalizeArabic('شُوكُولَاتَة'), 'شوكولاته');
});

test('creates useful conversational search tokens', () => {
  assert.deepEqual(searchTokens('بكام عشّ البلبل / مبرومة'), ['عش', 'البلبل', 'بلبل', 'مبرومه']);
  assert.deepEqual(searchTokens('سعر البقلاوة عندكم'), ['البقلاوه', 'بقلاوه']);
});
