import test from 'node:test';
import assert from 'node:assert/strict';
import { peerId, scanRecent } from '../extension/lib/monitor-engine.js';
test('identifica canais, grupos e pessoas sem misturar IDs', () => {
  assert.equal(peerId({ peerId: { channelId: 123n } }), '-100123');
  assert.equal(peerId({ peerId: { chatId: 123n } }), '-123');
  assert.equal(peerId({ peerId: { userId: 123n } }), '123');
  assert.equal(peerId({}), '');
});
test('busca canais escolhidos sem abrir conversas, respeita limite e cancelamento', async () => {
  const requests = [], batches = [];
  const client = { async getMessages(entity, options) { requests.push({ entity, ...options }); return [{ id: 42, message: 'Monitor Asus' }, { message: '' }]; } };
  await scanRecent(client, [{ id: '-1001', title: 'Canal A', entity: 'entidade-A' }, { id: '-1002', title: 'Canal B', entity: 'entidade-B' }],
    async (id, messages) => batches.push({ id, messages }));
  assert.deepEqual(requests.map(r => r.limit), [100, 100]);
  assert.deepEqual(batches.map(b => b.id), ['-1001', '-1002']);
  assert.equal(batches[0].messages[0].text, 'Monitor Asus');
  assert.equal(batches[0].messages[0].messageId, 42);
  await scanRecent(client, [{ id: '3' }], () => assert.fail('cancelado'), { stopped: () => true });
  assert.equal(requests.length, 2);
});
test('interrompe busca ao receber erro de limite do Telegram', async () => {
  let count = 0;
  const client = { async getMessages() { count++; throw new Error('FLOOD_WAIT_30'); } };
  await assert.rejects(scanRecent(client, [{ id: '1' }, { id: '2' }], () => {}), /FLOOD/);
  assert.equal(count, 1);
});
