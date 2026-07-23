import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV='test';
process.env.DATABASE_URL='postgresql://test:test@localhost:5432/test';
process.env.VOICE_API_TOKEN='voice-token-at-least-24-characters';
process.env.ADMIN_API_TOKEN='admin-token-at-least-24-characters';
process.env.PII_ENCRYPTION_KEY='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const security = await import('../src/utils/security.js');

test('encrypts and decrypts PII', () => {
  const encrypted = security.encryptText('0501234567');
  assert.notEqual(encrypted, '0501234567');
  assert.equal(security.decryptText(encrypted), '0501234567');
});

test('normalizes Saudi phone and hashes deterministically', () => {
  assert.equal(security.normalizePhone('050 123 4567'), '966501234567');
  assert.equal(security.hashPhone('0501234567'), security.hashPhone('+966501234567'));
});

test('constant-time token comparison behavior', () => {
  assert.equal(security.safeTokenEqual('abcdefgh', 'abcdefgh'), true);
  assert.equal(security.safeTokenEqual('abcdefgh', 'abcdefgi'), false);
  assert.equal(security.safeTokenEqual('abcdefgh', 'short'), false);
});
