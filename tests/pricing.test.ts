import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDraftTotal, calculateLineTotal } from '../src/services/pricing.js';

test('calculates line and draft totals precisely', () => {
  assert.equal(calculateLineTotal(130, 1.5), 195);
  assert.equal(calculateDraftTotal([{ price: 85, quantity: 2 }, { price: 4, quantity: 6 }]), 194);
});

test('rejects empty or invalid quantities', () => {
  assert.throws(() => calculateDraftTotal([]), /EMPTY_ITEMS/);
  assert.throws(() => calculateLineTotal(10, 0), /INVALID_QUANTITY/);
});
