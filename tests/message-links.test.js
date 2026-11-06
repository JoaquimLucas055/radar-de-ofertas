import test from 'node:test';
import assert from 'node:assert/strict';
import { messageLink, messagePayload } from '../extension/lib/message-links.js';
test('abre a mensagem exata de canais e supergrupos públicos ou privados no Web A', () => {
  const url = new URL(messageLink('-1001371796882', 115576));
  assert.equal(url.origin, 'https://web.telegram.org');
  const deep = new URL(new URLSearchParams(url.hash.slice(2)).get('tgaddr'));
  assert.equal(deep.hostname, 'privatepost');
  assert.equal(deep.searchParams.get('channel'), '1371796882');
  assert.equal(deep.searchParams.get('post'), '115576');
  assert.equal(messageLink('-100100123', 25).includes('channel%3D100123'), true, 'remove o prefixo apenas uma vez');
});
test('não inventa mensagem para resultados antigos, IDs inválidos ou grupos básicos', () => {
  for (const id of [undefined, null, 0, -1, 1.2, '12', NaN, Infinity, 2147483648]) assert.equal(messageLink('-100123', id), null);
  for (const chat of ['-123', '123', '-100', 'javascript:alert(1)', '-100123&post=2']) assert.equal(messageLink(chat, 42), null);
  assert.deepEqual(messagePayload({ id: 42, message: 'Monitor em promoção' }), { text: 'Monitor em promoção', messageId: 42 });
});
