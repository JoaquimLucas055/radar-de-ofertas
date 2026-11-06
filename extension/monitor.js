import { historyTime } from './lib/message-time.js';
import { messagePayload } from './lib/message-links.js';
import { codeDelivery } from './lib/login-delivery.js';
import { seal, unseal } from './lib/vault.js';
import { peerId, scanRecent } from './lib/monitor-engine.js';
const $ = selector => document.querySelector(selector);
let client, accountId, state, releaseLock, challenge, lib, heartbeat;
let generation = 0, dialogs = [], selected = new Set(), scanning = false, connecting = false;
let saveQueue = Promise.resolve();
const controls = ['#reload-channels', '#scan', '#disconnect'];
function info(text) { $('#feedback').textContent = text; }
async function request(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || 'O Radar não respondeu. Recarregue a extensão e esta aba.');
  return result.data;
}
function node(tag, text, className) {
  const result = document.createElement(tag);
  if (text != null) result.textContent = text;
  if (className) result.className = className;
  return result;
}
function action(text, fn) {
  const button = node('button', text, 'small secondary'); button.type = 'button';
  button.addEventListener('click', () => run(fn, button)); return button;
}
async function run(fn, button) {
  if (button) button.disabled = true;
  try { await fn(); } catch (error) { info(friendly(error)); }
  finally { if (button) button.disabled = controls.includes('#' + button.id) && !client; }
}
function friendly(error) {
  const text = error?.errorMessage || error?.message || String(error);
  if (/FLOOD|wait of|Too many/i.test(text)) return 'O Telegram pediu uma pausa. Aguarde antes de tentar novamente. ' + (error.seconds ? error.seconds + ' segundos.' : '');
  if (/SESSION_REVOKED|AUTH_KEY_UNREGISTERED/.test(text)) return 'A sessão foi revogada. Desconecte e faça login novamente.';
  if (/PHONE_CODE_INVALID/.test(text)) return 'Código de login incorreto. Tente conectar novamente.';
  if (/PHONE_CODE_EXPIRED/.test(text)) return 'O código expirou. Tente conectar novamente.';
  if (/PASSWORD_HASH_INVALID/.test(text)) return 'Senha de duas etapas incorreta.';
  if (/AUTH_USER_CANCEL/.test(text)) return 'Login cancelado.';
  return text;
}
function ask(label, type = 'text') {
  return new Promise((resolve, reject) => {
    challenge = { resolve, reject };
    $('#challenge-label').textContent = label;
    $('#challenge-value').type = type;
    $('#challenge-value').value = '';
    $('#challenge').hidden = false;
    $('#challenge-value').focus();
  });
}
$('#challenge-form').addEventListener('submit', event => {
  event.preventDefault();
  const pending = challenge;
  const value = $('#challenge-value').value.trim();
  if (!pending || !value) return;
  challenge = undefined; $('#challenge-value').value = ''; $('#challenge').hidden = true;
  pending.resolve(value);
});
$('#cancel-login').addEventListener('click', () => {
  challenge?.reject(new Error('AUTH_USER_CANCEL'));
  challenge = undefined; $('#challenge-value').value = ''; $('#challenge').hidden = true;
});
async function acquireLock() {
  await new Promise((resolve, reject) => {
    navigator.locks.request('radar-direct-connection', { ifAvailable: true }, async lock => {
      if (!lock) { reject(new Error('O monitoramento já está aberto em outra aba do Radar. Use aquela aba.')); return; }
      await new Promise(release => { releaseLock = release; resolve(); });
    }).catch(reject);
  });
}
async function connect(credentials, savedSession = '', password = '') {
  if (connecting || client) throw new Error('Já há uma conexão em andamento.');
  connecting = true;
  info('');
  const epoch = ++generation;
  try {
    await acquireLock();
    $('#connection').textContent = 'Conectando ao Telegram…';
    lib ||= await import('./vendor/telegram.js');
    client = new lib.TelegramClient(new lib.StringSession(savedSession), credentials.apiId, credentials.apiHash, {
      transport: new lib.WebSocketTransport(), connectionRetries: 3, requestRetries: 3,
      autoReconnect: true, deviceModel: 'Radar de Ofertas', appVersion: '0.2.0', floodSleepThreshold: 0
    });
    client.setLogLevel('none');
    await client.start({
      phoneNumber: () => Promise.resolve(credentials.phone),
      phoneCode: (isApp, delivery) => {
        const guidance = codeDelivery(isApp, delivery);
        info(guidance);
        $('#connection').textContent = 'Aguardando você informar o código';
        return ask(guidance);
      },
      password: () => ask('Sua senha de duas etapas do Telegram', 'password'),
      emailAddress: () => ask('E-mail solicitado pelo Telegram', 'email'),
      emailVerification: delivery => {
        info('O Telegram informou envio de código ao e-mail ' + (delivery?.emailPattern || 'da sua conta') + '.');
        $('#connection').textContent = 'Aguardando código do e-mail';
        return ask('Código enviado ao seu e-mail');
      },
      firstAndLastNames: () => { throw new Error('Use uma conta já existente do Telegram.'); },
      acceptTermsOfService: async () => false,
      onError: async error => { info(friendly(error)); throw error; }
    });
    if (generation !== epoch) return;
    if (!await client.checkAuthorization()) throw new Error('O login não foi concluído. Tente novamente.');
    const me = await client.getMe();
    accountId = me.id.toString();
    await request({ type: 'apiAccount', id: accountId });
    if (password) {
      const vault = await seal({ ...credentials, session: client.session.save() }, password);
      await chrome.storage.local.set({ apiVault: vault });
    }
    // Credentials, OTP and 2FA values are never logged or sent to the Radar worker.
    $('#api-hash').value = ''; $('#vault-password').value = ''; $('#unlock-password').value = ''; $('#phone').value = '';
    $('#login-panel').hidden = true;
    controls.forEach(selector => $(selector).disabled = false);
    $('#connection').textContent = 'Conectado · ' + (me.firstName || 'Sua conta');
    client.addEventHandler(async event => {
      if (generation !== epoch) return;
      const id = peerId(event.message);
      if (!selected.has(id)) return;
      try { await ingest(id, [messagePayload(event.message)]); }
      catch (error) { info(friendly(error)); }
    }, new lib.NewMessage({}));
    heartbeat = setInterval(() => {
      if (generation === epoch) $('#connection').textContent = client?.connected ?
        'Conectado · aguardando novas mensagens' : 'Conexão interrompida · tentando reconectar';
    }, 5000);
    await refreshState();
    await loadDialogs();
    info('Conectado. Marque os canais e clique em buscar para conferir mensagens anteriores.');
  } catch (error) {
    await disconnect(false);
    throw error;
  } finally { connecting = false; }
}
async function disconnect(forget = true) {
  ++generation; clearInterval(heartbeat);
  challenge?.reject(new Error('AUTH_USER_CANCEL')); challenge = undefined;
  $('#challenge').hidden = true; $('#challenge-value').value = '';
  const previous = client; client = undefined;
  try { if (previous) await previous.destroy(); }
  finally { releaseLock?.(); releaseLock = undefined; }
  if (forget) await chrome.storage.local.remove('apiVault');
  dialogs = []; selected.clear();
  controls.forEach(selector => $(selector).disabled = true);
  $('#connection').textContent = 'Desconectado';
  $('#login-panel').hidden = false;
  $('#channels').replaceChildren();
  await renderLogin();
}
async function renderLogin() {
  const { apiVault } = await chrome.storage.local.get('apiVault');
  $('#unlock-form').hidden = !apiVault;
  $('#login-form').hidden = Boolean(apiVault);
}
$('#login-form').addEventListener('submit', event => {
  event.preventDefault();
  run(async () => {
    const credentials = { apiId: Number($('#api-id').value), apiHash: $('#api-hash').value.trim(), phone: $('#phone').value.trim() };
    if (!Number.isSafeInteger(credentials.apiId) || credentials.apiId <= 0 || !/^[a-f0-9]{32}$/i.test(credentials.apiHash)) throw new Error('Confira o API ID e o API Hash fornecidos pelo Telegram.');
    if (!/^\+[0-9]{8,15}$/.test(credentials.phone)) throw new Error('Informe o telefone com +, país e DDD, sem espaços.');
    const password = $('#remember').checked ? $('#vault-password').value : '';
    if ($('#remember').checked && password.length < 10) throw new Error('Use pelo menos 10 caracteres na senha local.');
    await connect(credentials, '', password);
  }, $('#login-button'));
});
$('#unlock-form').addEventListener('submit', event => {
  event.preventDefault();
  run(async () => {
    const { apiVault } = await chrome.storage.local.get('apiVault');
    const credentials = await unseal(apiVault, $('#unlock-password').value);
    await connect(credentials, credentials.session);
  }, $('#unlock-button'));
});
$('#forget').addEventListener('click', () => run(async () => { await chrome.storage.local.remove('apiVault'); await renderLogin(); }));
$('#disconnect').addEventListener('click', () => run(() => disconnect(), $('#disconnect')));
async function loadDialogs() {
  if (!client) return;
  info('Carregando até 500 conversas para listar canais e grupos…');
  const list = await client.getDialogs({ limit: 500 });
  dialogs = list.filter(dialog => (dialog.isChannel || dialog.isGroup) && !dialog.entity?.left && !dialog.entity?.deactivated)
    .map(dialog => ({ id: dialog.id.toString(), title: dialog.title || dialog.name || 'Sem nome', entity: dialog.inputEntity }));
  renderChannels();
}
function renderChannels() {
  const target = $('#channels'); target.replaceChildren();
  const filter = $('#channel-search').value.toLocaleLowerCase('pt-BR');
  const visible = dialogs.filter(chat => chat.title.toLocaleLowerCase('pt-BR').includes(filter));
  if (!visible.length) target.append(node('p', client ? 'Nenhum canal encontrado para esse filtro.' : 'Conecte sua conta para carregar os canais.', 'empty'));
  for (const chat of visible) {
    const label = node('label', null, 'channel-row');
    const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(chat.id);
    checkbox.addEventListener('change', () => {
      checkbox.disabled = true;
      const enabled = checkbox.checked;
      saveQueue = saveQueue.catch(() => {}).then(async () => {
        if (enabled && selected.size >= 100) throw new Error('Escolha até 100 canais.');
        const next = new Set(selected);
        enabled ? next.add(chat.id) : next.delete(chat.id);
        const all = [...next].map(id => dialogs.find(item => item.id === id) || { id, title: state.apiChats[id]?.title || 'Canal' });
        await request({ type: 'apiSelectChats', chats: all.map(item => ({ id: item.id, title: item.title })) });
        selected = next;
        info(selected.size + ' canal(is) selecionado(s). Novas mensagens serão acompanhadas automaticamente.');
      }).catch(error => { checkbox.checked = selected.has(chat.id); info(friendly(error)); })
        .finally(() => { checkbox.disabled = false; });
    });
    label.append(checkbox, node('span', chat.title)); target.append(label);
  }
}
async function ingest(id, messages) {
  return request({ type: 'apiScan', accountId, chatId: id, messages });
}
$('#reload-channels').addEventListener('click', () => run(loadDialogs, $('#reload-channels')));
$('#channel-search').addEventListener('input', renderChannels);
$('#scan').addEventListener('click', () => run(async () => {
  if (!client || scanning) return;
  await saveQueue;
  await refreshState();
  if (state.paused) throw new Error('Retome o Radar antes de buscar.');
  if (!state.rules.some(rule => rule.enabled)) throw new Error('Cadastre e ative pelo menos um produto.');
  const channels = dialogs.filter(chat => selected.has(chat.id));
  if (!channels.length) throw new Error('Marque pelo menos um canal da lista.');
  scanning = true;
  const epoch = generation;
  try {
    await scanRecent(client, channels, async (id, batch) => { if (selected.has(id)) await ingest(id, batch); }, {
      onProgress: info, stopped: () => generation !== epoch || !client
    });
    if (generation === epoch) info('Busca concluída em ' + channels.length + ' canal(is). Confira as correspondências.');
    await refreshState();
  } finally { scanning = false; }
}, $('#scan')));
async function refreshState() {
  state = await request({ type: 'state' });
  selected = new Set(Object.keys(state.apiChats || {}));
  $('#pause').textContent = state.paused ? 'Retomar' : 'Pausar';
  const products = $('#products'); products.replaceChildren();
  for (const rule of state.rules) {
    const row = node('div', null, 'entry');
    row.append(node('h3', rule.query + (rule.enabled ? '' : ' · pausado')));
    const buttons = node('div', null, 'actions');
    buttons.append(action(rule.enabled ? 'Pausar' : 'Ativar', async () => { await request({ type: 'toggleRule', id: rule.id }); await refreshState(); }),
      action('Excluir', async () => { await request({ type: 'deleteRule', id: rule.id }); await refreshState(); }));
    row.append(buttons); products.append(row);
  }
  renderResults();
}
function renderResults() {
  if (!state) return;
  const target = $('#results'); target.replaceChildren();
  const filter = $('#history-search').value.toLocaleLowerCase('pt-BR');
  const matches = state.history.filter(item => (item.query + ' ' + item.chat + ' ' + item.text).toLocaleLowerCase('pt-BR').includes(filter));
  if (!matches.length) target.append(node('p', 'Nenhuma correspondência ainda. Cadastre um produto, marque canais e clique em buscar.', 'empty'));
  for (const item of matches) {
    const card = node('article', null, 'offer');
    card.append(node('span', item.query, 'pill'), node('p', item.chat + ' · ' + historyTime(item), 'meta'), node('p', item.text, 'message'));
    const url = new URL(item.messageUrl || item.url);
    if (url.origin === 'https://web.telegram.org') {
      const link = node('a', item.messageUrl ? 'Abrir mensagem ↗' : 'Abrir conversa ↗', 'text-link');
      link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; card.append(link);
    }
    target.append(card);
  }
}
$('#product-form').addEventListener('submit', event => {
  event.preventDefault();
  run(async () => {
    await request({ type: 'saveRule', rule: { query: $('#product').value, exclude: $('#excluded').value } });
    event.target.reset(); await refreshState();
    info('Produto cadastrado. Para conferir mensagens anteriores, clique em buscar.');
  }, event.submitter);
});
$('#pause').addEventListener('click', () => run(async () => { await request({ type: 'pause' }); await refreshState(); }));
$('#history-search').addEventListener('input', renderResults);
let reload;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && ['history', 'rules', 'paused', 'notificationWarning'].some(key => key in changes)) {
    clearTimeout(reload); reload = setTimeout(() => refreshState().catch(error => info(friendly(error))), 200);
  }
});
window.addEventListener('beforeunload', event => {
  if (client || connecting) { event.preventDefault(); event.returnValue = ''; }
});
await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
await renderLogin();
await refreshState();
renderChannels();
