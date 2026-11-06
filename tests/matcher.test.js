import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, matchesRule, containsPhrase, validateRule, safeTelegramUrl, eventKey } from '../extension/lib/matcher.js';
const rule = { query: 'fone bluetooth', exclude: 'usado, sem garantia', enabled: true };
test('normaliza acentos, caixa e pontuação', () => {
  assert.equal(normalize('  PROMOÇÃO: Fóne!  '), 'promocao fone');
  assert.equal(matchesRule('BLUETOOTH: fone em promoção por R$ 100', rule), true);
});
test('exige todas as palavras e respeita limites', () => {
  assert.equal(matchesRule('microfone bluetooth', rule), false);
  assert.equal(matchesRule('fone com fio', rule), false);
  assert.equal(containsPhrase('iPhone 150', 'iphone 15'), false);
});
test('exclui palavras e expressões completas', () => {
  assert.equal(matchesRule('fone bluetooth usado', rule), false);
  assert.equal(matchesRule('fone bluetooth SEM GARANTIA', rule), false);
  assert.equal(matchesRule('fone bluetooth seminovo com garantia', rule), true);
});
test('regras vazias, desativadas e exclusões vazias', () => {
  assert.equal(matchesRule('qualquer coisa', { query: '', enabled: true }), false);
  assert.equal(matchesRule('fone bluetooth', { ...rule, enabled: false }), false);
  assert.equal(matchesRule('fone bluetooth', { ...rule, exclude: ', ,' }), true);
  assert.throws(() => validateRule({ query: '!!!' }));
  assert.throws(() => validateRule({ query: 'x'.repeat(121) }));
  assert.throws(() => validateRule({ query: 'fone', exclude: 'x'.repeat(241) }));
});
test('somente URLs HTTPS do Telegram Web', () => {
  assert.equal(safeTelegramUrl('https://web.telegram.org/k/#-123'), 'https://web.telegram.org/k/#-123');
  for (const url of ['javascript:alert(1)', 'https://web.telegram.org.evil.com/', 'https://web.telegram.org@evil.com/', 'http://web.telegram.org/', 'https://evil@web.telegram.org/', 'https://web.telegram.org:8443/']) assert.equal(safeTelegramUrl(url), null);
});
test('deduplicação persiste por conversa, texto e produto', async () => {
  const first = await eventKey('/k/#1', 'fone bluetooth', 'rule1');
  assert.equal(first, await eventKey('/k/#1', 'fone bluetooth ', 'rule1'));
  assert.notEqual(first, await eventKey('/k/#2', 'fone bluetooth', 'rule1'));
  assert.notEqual(first, await eventKey('/k/#1', 'fone bluetooth', 'rule2'));
  assert.notEqual(first, await eventKey('/k/#1', 'fone bluetooth R$ 80', 'rule1'));
});
