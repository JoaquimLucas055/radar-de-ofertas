import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
test('troca de chats com nós reutilizados, resposta atrasada e replaceState', async () => {
  let now = 0, poll, deferred;
  const calls = [], nodes = [];
  class Element {
    textContent = ''; style = {}; handlers = {};
    append() {} setAttribute() {}
    attachShadow() { return { append() {} }; }
    addEventListener(type, fn) { this.handlers[type] = fn; }
  }
  const messageNode = { innerText: 'fone bluetooth', getClientRects: () => [1], closest: () => null };
  const location = { pathname: '/k/', hash: '#1', get href() { return 'https://web.telegram.org/k/' + this.hash; } };
  const chats = { '/k/#1': {}, '/k/#2': {}, '/k/#3': {} };
  const sandbox = {
    Date: { now: () => now }, location,
    document: {
      createElement() { const node = new Element(); nodes.push(node); return node; },
      documentElement: { append() {} },
      querySelector: () => ({ textContent: 'Canal ' + location.hash }),
      querySelectorAll: () => [messageNode]
    },
    window: { addEventListener() {} },
    chrome: { runtime: { id: 'test', async sendMessage(message) {
      calls.push(message);
      if (message.type === 'status' && deferred) return await deferred.promise;
      return { ok: true, data: message.type === 'status' ? { chats, paused: false } : {} };
    } } },
    setInterval(fn) { poll = fn; return 1; }, clearInterval() {}
  };
  sandbox.window.top = sandbox.window;
  vm.runInNewContext(fs.readFileSync(new URL('../extension/content.js', import.meta.url), 'utf8'), sandbox);
  now = 2000; await poll();
  assert.equal(calls.filter(x => x.type === 'scan').at(-1).id, '/k/#1');
  location.hash = '#2'; await poll();
  now = 4000; await poll();
  const scan = calls.filter(x => x.type === 'scan').at(-1);
  assert.equal(scan.id, '/k/#2');
  assert.equal(scan.messages.length, 1, 'reused nodes must remain readable');
  deferred = {}; deferred.promise = new Promise(resolve => deferred.resolve = resolve);
  const pending = poll();
  location.hash = '#3';
  deferred.resolve({ ok: true, data: { chats, paused: false } });
  await pending; deferred = null;
  assert.equal(calls.filter(x => x.type === 'scan').at(-1).id, '/k/#2', 'old response cannot scan new chat');
  now = 6000; await poll();
  assert.equal(calls.filter(x => x.type === 'scan').at(-1).id, '/k/#3', 'detect navigation without hashchange');
});
