import test from 'node:test';
import assert from 'node:assert/strict';
let state = {};
let listener;
let failNotifications = false;
const notifications = [];
globalThis.chrome = {
  runtime: {
    id: 'radar-test',
    getURL: path => 'chrome-extension://radar-test/' + path,
    onInstalled: { addListener() {} },
    onMessage: { addListener(fn) { listener = fn; } }
  },
  storage: { local: {
    async get(defaults) { return structuredClone({ ...defaults, ...state }); },
    async set(update) { state = { ...state, ...structuredClone(update) }; },
    async setAccessLevel() {}
  } },
  action: { onClicked: { addListener() {} }, async setBadgeText() {}, async setBadgeBackgroundColor() {} },
  tabs: { async create() {} },
  notifications: {
    onClicked: { addListener() {} },
    async create(id, data) {
      if (failNotifications) throw new Error('Notificações bloqueadas');
      notifications.push({ id, data });
    }
  }
};
await import('../extension/background.js');
const dashboard = { id: 'radar-test', url: 'chrome-extension://radar-test/dashboard.html' };
const web = id => ({ id: 'radar-test', url: 'https://web.telegram.org/k/#' + id, tab: { id: 1 } });
function send(message, sender = dashboard) {
  return new Promise(resolve => {
    const asyncReply = listener(message, sender, resolve);
    if (!asyncReply) resolve({ ok: false });
  });
}
function chat(type, id, text) {
  return send({ type, url: 'https://web.telegram.org/k/#' + id, title: 'Canal ' + id, messages: [{ text }] }, web(id));
}
test('worker: permissões, fluxo de alerta, deduplicação e concorrência', async () => {
  assert.equal((await send({ type: 'saveRule', rule: { query: 'fone bluetooth' } }, web(1))).ok, false);
  assert.equal((await send({ type: 'state' }, { ...dashboard, id: 'outro' })).ok, false);
  assert.equal((await send({ type: 'state' }, { id: 'radar-test', url: 'https://evil.com', tab: { id: 1 } })).ok, false);
  assert.equal((await send({ type: 'saveRule', rule: { query: '!!!' } })).ok, false);
  const saved = await send({ type: 'saveRule', rule: { query: 'fone bluetooth', exclude: 'usado' } });
  assert.equal(saved.ok, true);
  await chat('scan', 1, 'fone bluetooth barato');
  assert.equal(state.history, undefined, 'não armazena mensagens de conversas não autorizadas');
  await chat('toggleChat', 1);
  await chat('scan', 1, 'fone bluetooth barato');
  assert.equal(state.history.length, 1);
  assert.equal(notifications.length, 1);
  await chat('scan', 1, 'fone bluetooth barato');
  assert.equal(state.history.length, 1);
  assert.equal(notifications.length, 1);
  await chat('scan', 1, 'fone bluetooth usado');
  assert.equal(state.history.length, 1);
  const spoof = await send({ type: 'scan', url: 'https://web.telegram.org/k/#2', messages: [{ text: 'fone bluetooth' }] }, web(1));
  assert.equal(spoof.ok, false);
  await send({ type: 'pause' });
  await chat('scan', 1, 'fone bluetooth pausado');
  assert.equal(state.history.length, 1);
  await send({ type: 'pause' });
  await chat('toggleChat', 2);
  await Promise.all([chat('scan', 1, 'fone bluetooth R$ 80'), chat('scan', 2, 'fone bluetooth R$ 90')]);
  assert.equal(state.history.length, 3);
  failNotifications = true;
  await chat('scan', 1, 'fone bluetooth R$ 100');
  assert.equal(state.history.length, 4, 'salva mesmo sem notificação');
  assert.equal(state.notificationWarning, true);
  await send({ type: 'clearHistory' });
  assert.equal(state.history.length, 0);
  await chat('scan', 1, 'fone bluetooth R$ 100');
  assert.equal(state.history.length, 0, 'limpar não repete alertas');
  await send({ type: 'removeChat', id: '/k/#1' });
  await chat('scan', 1, 'fone bluetooth R$ 110');
  assert.equal(state.history.length, 0);
  await send({ type: 'toggleRule', id: saved.data.id });
  await chat('scan', 2, 'fone bluetooth R$ 120');
  assert.equal(state.history.length, 0);
});
