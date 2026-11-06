import test from 'node:test';
import assert from 'node:assert/strict';
import { codeDelivery } from '../extension/lib/login-delivery.js';
test('orienta a entrega informada pelo Telegram sem prometer SMS', () => {
  assert.match(codeDelivery(true), /aplicativo Telegram/);
  assert.match(codeDelivery(false, { type: 'sms' }), /por SMS/);
  assert.match(codeDelivery(false, { type: 'call' }), /ligação/);
  assert.match(codeDelivery(false, { type: 'smsPhrase' }), /frase/);
  assert.match(codeDelivery(false, { type: 'unknown' }), /métodos de entrega/);
});
