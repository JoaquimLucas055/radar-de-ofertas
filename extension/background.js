import { matchesRule, validateRule, safeTelegramUrl, eventKey } from './lib/matcher.js';

let pending = Promise.resolve();
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
});
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }));
chrome.notifications.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') }));
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return false;
  // A service worker processes one mutation at a time, including across multiple tabs.
  pending = pending.catch(() => {}).then(async () => {
    try { reply({ ok: true, data: await handle(message, sender) }); }
    catch (error) { reply({ ok: false, error: error.message || 'Falha ao concluir a operação.' }); }
  });
  return true;
});

async function handle(message, sender) {
  const fromWeb = Boolean(sender.tab && safeTelegramUrl(sender.url));
  const fromDashboard = sender.url === chrome.runtime.getURL('dashboard.html');
  if (!fromWeb && !fromDashboard) throw new Error('Origem não autorizada.');
  const state = await chrome.storage.local.get({
    rules: [], chats: {}, history: [], seen: [], paused: false, lastScan: null, notificationWarning: false
  });
  if (message.type === 'status' && fromWeb) return { chats: state.chats, paused: state.paused };
  if (message.type === 'state' && fromDashboard) {
    await chrome.action.setBadgeText({ text: '' });
    return state;
  }
  if (message.type === 'saveRule' && fromDashboard) {
    if (state.rules.length >= 50) throw new Error('Limite de 50 produtos.');
    const rule = { ...validateRule(message.rule), id: crypto.randomUUID() };
    await chrome.storage.local.set({ rules: [...state.rules, rule] });
    return rule;
  }
  if (message.type === 'toggleRule' && fromDashboard) {
    await chrome.storage.local.set({ rules: state.rules.map(rule => rule.id === message.id ? { ...rule, enabled: !rule.enabled } : rule) });
    return;
  }
  if (message.type === 'deleteRule' && fromDashboard) {
    await chrome.storage.local.set({ rules: state.rules.filter(rule => rule.id !== message.id) });
    return;
  }
  if (message.type === 'pause' && fromDashboard) {
    await chrome.storage.local.set({ paused: !state.paused });
    return;
  }
  if (message.type === 'clearHistory' && fromDashboard) {
    // Retain deduplication to avoid immediately repeating cleared alerts.
    await chrome.storage.local.set({ history: [] });
    return;
  }
  if (message.type === 'removeChat' && fromDashboard) {
    delete state.chats[message.id];
    await chrome.storage.local.set({ chats: state.chats });
    return;
  }
  if ((message.type === 'toggleChat' || message.type === 'scan') && fromWeb) {
    const url = safeTelegramUrl(message.url);
    const source = new URL(sender.url);
    if (!url || new URL(url).pathname !== source.pathname || new URL(url).hash !== source.hash || !source.hash.slice(1)) {
      throw new Error('Abra uma conversa antes de monitorar.');
    }
    const chatId = source.pathname + source.hash;
    if (message.type === 'toggleChat') {
      if (state.chats[chatId]) delete state.chats[chatId];
      else {
        if (Object.keys(state.chats).length >= 100) throw new Error('Limite de 100 conversas.');
        state.chats[chatId] = { title: String(message.title || 'Conversa').slice(0, 160), url };
      }
      await chrome.storage.local.set({ chats: state.chats });
      return { monitoring: Boolean(state.chats[chatId]) };
    }
    if (state.paused || !state.chats[chatId]) return;
    if (!Array.isArray(message.messages)) throw new Error('Mensagens inválidas.');
    const found = [];
    const seen = new Set(state.seen);
    for (const item of message.messages.slice(0, 100)) {
      if (typeof item?.text !== 'string') continue;
      const text = item.text.slice(0, 6000).trim();
      if (!text) continue;
      for (const rule of state.rules) {
        if (!matchesRule(text, rule)) continue;
        const id = await eventKey(chatId, text, rule.id);
        if (seen.has(id)) continue;
        seen.add(id);
        found.push({ id, query: rule.query, text, chat: state.chats[chatId].title, url, at: Date.now() });
      }
    }
    await chrome.storage.local.set({
      seen: [...seen].slice(-5000), history: [...found.reverse(), ...state.history].slice(0, 200),
      lastScan: { at: Date.now(), count: message.messages.length, chat: state.chats[chatId].title }
    });
    if (found.length) {
      await chrome.action.setBadgeText({ text: '!' });
      await chrome.action.setBadgeBackgroundColor({ color: '#087e6b' });
      try {
        await chrome.notifications.create('radar-latest', {
          type: 'basic', iconUrl: 'icons/icon128.png',
          title: found.length + ' correspondência(s) no Radar',
          message: found[0].query + ' · ' + found[0].chat + '\nAbra o Radar para conferir a mensagem.',
          priority: 1
        });
        await chrome.storage.local.set({ notificationWarning: false });
      } catch {
        await chrome.storage.local.set({ notificationWarning: true });
      }
    }
    return { found: found.length };
  }
  throw new Error('Operação não disponível.');
}
