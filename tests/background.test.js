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
  tabs: { async create() {}, async get(id) { return { url: id === 99 ? 'https://example.com/' : 'https://web.telegram.org/k/#' + id }; } },
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
const web = id => ({ id: 'radar-test', url: 'https://web.telegram.org/k/#' + id, tab: { id } });
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
  // Regression: sender retains the original document URL after SPA navigation.
  const navigated = { ...web(3), url: 'https://web.telegram.org/k/#1' };
  const added = await send({ type: 'toggleChat', url: 'https://web.telegram.org/k/#3', title: 'Outro canal' }, navigated);
  assert.equal(added.ok, true);
  assert.equal(state.chats['/k/#3'].title, 'Outro canal');
  const stale = await send({ type: 'scan', url: 'https://web.telegram.org/k/#1', messages: [] }, navigated);
  assert.equal(stale.ok, false, 'rejects batches from the previous conversation');
  const leftTelegram = await send({ type: 'toggleChat', url: 'https://web.telegram.org/k/#99' }, web(99));
  assert.equal(leftTelegram.ok, false);
});

test('modo direto: seleção explícita, conta correta, pausa e isolamento', async () => {
  state = {}; failNotifications = false;
  const monitor = { ...dashboard, url: 'chrome-extension://radar-test/monitor.html' };
  assert.equal((await send({ type: 'apiAccount', id: '55' }, web(1))).ok, false);
  await send({ type: 'apiAccount', id: '55' }, monitor);
  await send({ type: 'saveRule', rule: { query: 'monitor asus' } }, monitor);
  const scan = (chatId, accountId = '55', text = 'Monitor Asus por R$ 999') =>
    send({ type: 'apiScan', accountId, chatId, messages: [{ text }] }, monitor);
  await scan('-1001');
  assert.equal(state.history.length, 0, 'ignora canais não escolhidos');
  const invalid = await send({ type: 'apiSelectChats', chats: [{ id: 'evil' }] }, monitor);
  assert.equal(invalid.ok, false);
  await send({ type: 'apiSelectChats', chats: [{ id: '-1001', title: 'Canal A' }, { id: '-1002', title: 'Canal B' }] }, monitor);
  await scan('-1001', 'outra');
  assert.equal(state.history.length, 0, 'ignora conta diferente');
  await Promise.all([scan('-1001'), scan('-1002')]);
  assert.equal(state.history.length, 2);
  assert.deepEqual(new Set(state.history.map(item => item.chat)), new Set(['Canal A', 'Canal B']));
  await scan('-1001');
  assert.equal(state.history.length, 2, 'deduplica busca e evento');
  await send({ type: 'pause' });
  await scan('-1001', '55', 'Monitor Asus R$ 800');
  assert.equal(state.history.length, 2);
  await send({ type: 'pause' });
  await send({ type: 'apiSelectChats', chats: [{ id: '-1002', title: 'Canal B' }] }, monitor);
  await scan('-1001', '55', 'Monitor Asus R$ 700');
  assert.equal(state.history.length, 2, 'remover seleção interrompe recebimento');
  await send({ type: 'apiAccount', id: '66' }, monitor);
  assert.deepEqual(state.apiChats, {});
  assert.equal(state.history.length, 0, 'outra conta não vê histórico anterior');
  assert.equal(state.rules.length, 1, 'preserva produtos');
});

test('busca atualiza links antigos sem repetir alertas e salva a postagem dos eventos novos', async () => {
  state = {}; failNotifications = false;
  const monitor = { ...dashboard, url: 'chrome-extension://radar-test/monitor.html' };
  await send({ type: 'apiAccount', id: '55' }, monitor);
  await send({ type: 'saveRule', rule: { query: 'monitor asus' } }, monitor);
  await send({ type: 'apiSelectChats', chats: [{ id: '-1001234', title: 'Promoções' }] }, monitor);
  const scan = message => send({ type: 'apiScan', accountId: '55', chatId: '-1001234', messages: [message] }, monitor);
  await scan({ text: 'Monitor Asus R$ 900' });
  assert.equal(state.history[0].messageUrl, undefined);
  const notified = notifications.length;
  const discoveredAt = state.history[0].at;
  const postedAt = Date.parse('2026-11-05T19:30:00Z');
  const editedAt = Date.parse('2026-11-05T19:46:00Z');
  await scan({ text: 'Monitor Asus R$ 900', messageId: 42, postedAt, editedAt });
  assert.equal(state.history[0].postedAt, postedAt);
  assert.equal(state.history[0].editedAt, editedAt);
  assert.equal(state.history[0].at, discoveredAt, 'preserva separadamente o horário da descoberta');
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].messageId, 42);
  assert.match(decodeURIComponent(state.history[0].messageUrl), /privatepost\?channel=1234&post=42$/);
  assert.equal(notifications.length, notified, 'enriquecer histórico não notifica novamente');
  await scan({ text: 'Monitor Asus R$ 800', messageId: 43 });
  assert.equal(state.history[0].messageId, 43);
  assert.match(decodeURIComponent(state.history[0].messageUrl), /post=43$/);
  await scan({ text: 'Monitor Asus R$ 700', messageId: 'javascript:alert(1)' });
  assert.equal(state.history[0].messageUrl, undefined);
  assert.equal(state.history[0].url, 'https://web.telegram.org/a/#-1001234');
});

test('regressão: limpar histórico e buscar novamente recupera produtos sem repetir notificações', async () => {
  state = {}; failNotifications = false;
  const monitor = { ...dashboard, url: 'chrome-extension://radar-test/monitor.html' };
  await send({ type: 'apiAccount', id: '55' }, monitor);
  await send({ type: 'saveRule', rule: { query: 'XG27ACS' } }, monitor);
  await send({ type: 'saveRule', rule: { query: '5060' } }, monitor);
  const chats = [{ id: '-1001234', title: 'Canal A' }, { id: '-1005678', title: 'Canal B' }, { id: '-1009999', title: 'Canal C' }];
  await send({ type: 'apiSelectChats', chats }, monitor);
  const messages = [
    { text: 'Monitor ASUS ROG XG27ACS em promoção', messageId: 42, postedAt: 1793907000000 },
    { text: 'Placa RTX 5060 8GB', messageId: 43, postedAt: 1793908000000 }
  ];
  const scan = (manualSearch = false) => send({ type: 'apiScan', accountId: '55', chatId: chats[0].id, messages, manualSearch }, monitor);
  await scan();
  assert.equal(state.history.length, 2);
  const notified = notifications.length;
  await send({ type: 'clearHistory' });
  await scan();
  assert.equal(state.history.length, 0, 'eventos automáticos não recriam o histórico apagado');
  const result = await scan(true);
  assert.equal(state.history.length, 2, 'a busca manual deve recuperar as duas ofertas');
  assert.equal(result.data.restored, 2);
  assert.equal(result.data.matched, 2);
  assert.equal(result.data.found, 0);
  assert.equal(notifications.length, notified, 'restaurar não repete alertas');
  assert.equal(state.history.find(item => item.messageId === 42).postedAt, messages[0].postedAt);
  await scan(true);
  assert.equal(state.history.length, 2, 'não duplica resultados na busca seguinte');
  assert.equal(notifications.length, notified);
});

test('fluxo completo: busca por produto acha postagens fora das 100 recentes e recupera após limpar', async () => {
  const { scanRecent } = await import('../extension/lib/monitor-engine.js');
  state = {}; failNotifications = false;
  const monitor = { ...dashboard, url: 'chrome-extension://radar-test/monitor.html' };
  await send({ type: 'apiAccount', id: '55' }, monitor);
  for (const query of ['XG27ACS', '5060']) await send({ type: 'saveRule', rule: { query } }, monitor);
  const chats = [
    { id: '-1001234', title: 'Canal A', entity: 'a' },
    { id: '-1005678', title: 'Canal B', entity: 'b' },
    { id: '-1009999', title: 'Canal C', entity: 'c' }
  ];
  await send({ type: 'apiSelectChats', chats }, monitor);
  const posts = {
    a: [{ id: 42, message: 'Monitor ASUS ROG XG27ACS em promoção', date: 1793907000 },
        { id: 43, message: 'RTX 5060 8GB GDDR7', date: 1793908000 }],
    b: [{ id: 44, message: 'Placa de vídeo 5060 por R$ 2597', date: 1793909000 }],
    c: []
  };
  const requests = [];
  const client = { async getMessages(entity, options) {
    requests.push({ entity, ...options });
    return options.search ? posts[entity].filter(post => post.message.includes(options.search)) :
      [{ id: 200, message: 'Cupom de frete grátis', date: 1793919000 }];
  } };
  const ingest = async (chatId, messages) => {
    const result = await send({ type: 'apiScan', accountId: '55', chatId, messages, manualSearch: true }, monitor);
    assert.equal(result.ok, true); return result.data;
  };
  const recent = await scanRecent(client, chats, ingest);
  assert.equal(recent.matched, 0);
  assert.equal(recent.messages, 3);
  const first = await scanRecent(client, chats, ingest, { queries: ['XG27ACS', '5060'] });
  assert.equal(first.rows.length, 6);
  assert.equal(first.matched, 3);
  assert.equal(first.found, 3);
  assert.equal(state.history.length, 3);
  const offer = state.history.find(item => item.messageId === 42);
  assert.equal(offer.postedAt, 1793907000000);
  assert.match(decodeURIComponent(offer.messageUrl), /channel=1234&post=42$/);
  const notified = notifications.length;
  await send({ type: 'clearHistory' });
  const again = await scanRecent(client, chats, ingest, { queries: ['XG27ACS', '5060'] });
  assert.equal(again.restored, 3);
  assert.equal(again.found, 0);
  assert.equal(state.history.length, 3);
  assert.equal(notifications.length, notified);
  assert.ok(requests.filter(request => request.search).every(request => request.limit === 100));
});
