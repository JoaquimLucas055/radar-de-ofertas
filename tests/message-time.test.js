import test from 'node:test';
import assert from 'node:assert/strict';
import { fromTelegramTime, messageTimes, historyTime } from '../extension/lib/message-time.js';
import { messagePayload } from '../extension/lib/message-links.js';
test('preserva a data original e a edição do Telegram em milissegundos', () => {
  const date = Date.parse('2026-11-05T19:30:00Z');
  const edit = Date.parse('2026-11-05T19:46:00Z');
  const payload = messagePayload({ id: 42, message: 'Oferta', date: date / 1000, editDate: edit / 1000 });
  assert.equal(payload.postedAt, date); assert.equal(payload.editedAt, edit);
  const text = historyTime({ ...payload, at: Date.parse('2026-11-06T00:54:28Z') });
  assert.match(text, /Publicado em 05\/11\/2026, 16:30/);
  assert.match(text, /Editado em 05\/11\/2026, 16:46/);
  assert.doesNotMatch(text, /21:54/);
});
test('histórico antigo identifica a hora da descoberta sem inventar a data da postagem', () => {
  assert.match(historyTime({ at: Date.parse('2026-11-06T00:54:28Z') }), /Encontrado em 05\/11\/2026, 21:54/);
  assert.match(historyTime({}), /indisponível/);
});
test('rejeita datas inválidas e edição anterior à postagem', () => {
  for (const input of [0, -1, '1793907000', NaN, Infinity, 1e30]) assert.equal(fromTelegramTime(input), null);
  assert.deepEqual(messageTimes({ postedAt: 5000, editedAt: 4000 }), { postedAt: 5000 });
  assert.deepEqual(messageTimes({ postedAt: '5000', editedAt: NaN }), {});
});
