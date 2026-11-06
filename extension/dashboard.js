const $ = selector => document.querySelector(selector);
let current;
async function request(message) {
  const result = await chrome.runtime.sendMessage(message);
  if (!result?.ok) throw new Error(result?.error || 'Falha ao acessar o Radar.');
  return result.data;
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function action(label, message) {
  const button = element('button', label, 'small secondary');
  button.type = 'button';
  button.addEventListener('click', () => mutate(message, button));
  return button;
}
function empty(target, text) { target.append(element('div', text, 'empty')); }
function chatLink(url, exactMessage = false) {
  const link = element('a', exactMessage ? 'Abrir mensagem ↗' : 'Abrir conversa ↗', 'text-link');
  // URLs come from the trusted worker; keep defense in depth for local state.
  try {
    const parsed = new URL(url);
    if (parsed.origin !== 'https://web.telegram.org') return link;
    link.href = parsed.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
  } catch { /* Render inert text for invalid URLs. */ }
  return link;
}
function renderHistory() {
  const target = $('#history'); target.replaceChildren();
  const filter = $('#search').value.toLocaleLowerCase('pt-BR');
  const history = current.history.filter(item => (item.query + ' ' + item.chat + ' ' + item.text).toLocaleLowerCase('pt-BR').includes(filter));
  if (!history.length) return empty(target, filter ? 'Nenhuma correspondência para essa busca.' : 'Seus achados aparecem aqui. Cadastre um produto e escolha uma conversa no Telegram.');
  for (const item of history) {
    const card = element('article', undefined, 'offer');
    card.append(element('span', item.query, 'pill'));
    card.append(element('p', item.chat + ' · ' + new Date(item.at).toLocaleString('pt-BR'), 'meta'));
    card.append(element('p', item.text, 'message'), chatLink(item.messageUrl || item.url, Boolean(item.messageUrl)));
    target.append(card);
  }
}
async function load() {
  current = await request({ type: 'state' });
  const ruleCount = current.rules.filter(rule => rule.enabled).length;
  const chatCount = Object.keys(current.chats).length;
  $('#status-text').textContent = current.paused ? 'Monitoramento pausado' : ruleCount + ' produto(s) ativo(s) · ' + chatCount + ' conversa(s) cadastrada(s)';
  $('#pause').textContent = current.paused ? 'Retomar' : 'Pausar';
  $('#rule-count').textContent = current.rules.length;
  $('#chat-count').textContent = chatCount;
  const rules = $('#rules'); rules.replaceChildren();
  if (!current.rules.length) empty(rules, 'Sua próxima descoberta começa com um produto.');
  for (const rule of current.rules) {
    const row = element('article', undefined, 'entry' + (rule.enabled ? '' : ' muted'));
    row.append(element('h3', rule.query), element('p', rule.exclude ? 'Ignorar: ' + rule.exclude : 'Sem termos excluídos', 'meta'));
    const buttons = element('div', undefined, 'actions');
    buttons.append(action(rule.enabled ? 'Pausar' : 'Ativar', { type: 'toggleRule', id: rule.id }), action('Excluir', { type: 'deleteRule', id: rule.id }));
    row.append(buttons); rules.append(row);
  }
  const chats = $('#chats'); chats.replaceChildren();
  if (!chatCount) empty(chats, 'No Telegram Web, abra uma conversa e clique no botão verde do Radar.');
  for (const [id, chat] of Object.entries(current.chats)) {
    const row = element('article', undefined, 'entry');
    row.append(element('h3', chat.title), chatLink(chat.url));
    const buttons = element('div', undefined, 'actions');
    buttons.append(action('Remover', { type: 'removeChat', id })); row.append(buttons); chats.append(row);
  }
  $('#last-scan').textContent = current.lastScan ? 'Última leitura: ' + new Date(current.lastScan.at).toLocaleString('pt-BR') + ' · ' + current.lastScan.count + ' mensagem(ns) · ' + current.lastScan.chat : 'Aguardando a primeira leitura.';
  if (current.notificationWarning) $('#feedback').textContent = 'Não foi possível mostrar a notificação. Confira as permissões do navegador e do Windows; o histórico foi salvo.';
  renderHistory();
}
async function mutate(message, button) {
  if (button) button.disabled = true;
  $('#feedback').textContent = '';
  try { await request(message); await load(); return true; }
  catch (error) { $('#feedback').textContent = error.message; return false; }
  finally { if (button) button.disabled = false; }
}
$('#rule-form').addEventListener('submit', async event => {
  event.preventDefault();
  const ok = await mutate({ type: 'saveRule', rule: { query: $('#query').value, exclude: $('#exclude').value } }, event.submitter);
  if (ok) { event.target.reset(); $('#feedback').textContent = 'Alerta criado. A próxima leitura das conversas abertas usa a nova regra.'; $('#query').focus(); }
});
$('#pause').addEventListener('click', event => mutate({ type: 'pause' }, event.currentTarget));
$('#clear').addEventListener('click', event => mutate({ type: 'clearHistory' }, event.currentTarget));
$('#search').addEventListener('input', renderHistory);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && ['history', 'rules', 'chats', 'paused', 'lastScan', 'notificationWarning'].some(key => key in changes)) {
    load().catch(error => { $('#feedback').textContent = error.message; });
  }
});
load().catch(error => { $('#feedback').textContent = error.message; });
