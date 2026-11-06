import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const sandbox = { console, crypto: globalThis.crypto, TextEncoder, TextDecoder, URL, URLSearchParams, atob, btoa,
  setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, performance, AbortController,
  navigator: { userAgent: 'Chrome Test Browser' }, localStorage: { getItem() { return null; }, setItem() {} } };
sandbox.self = sandbox; sandbox.window = sandbox;
const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
const mod = new vm.SourceTextModule(fs.readFileSync('extension/vendor/telegram.js','utf8'), { context });
await mod.link(specifier => { throw new Error('Dependência externa no bundle: ' + specifier); });
await mod.evaluate({ timeout: 30000 });
const { TelegramClient, StringSession, WebSocketTransport, NewMessage, Api } = mod.namespace;
assert.equal(typeof TelegramClient, 'function'); assert.equal(typeof NewMessage, 'function');
assert.equal(new StringSession('').save(), '');
const client = new TelegramClient(new StringSession(''), 12345, 'a'.repeat(32), { transport: new WebSocketTransport() });
client.setLogLevel('none');
assert.ok(client); assert.ok(Api.messages.GetHistory);
await client.destroy();
console.log('Bundle inicializa em ambiente de navegador sem eval, WASM ou módulos externos.');
