(() => {
  if (window.top !== window) return;
  let stopped = false;
  let busy = false;
  let timer;
  let navigationBaseline = new Map();
  const host = document.createElement('div');
  host.id = 'radar-ofertas-control';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = ':host{position:fixed;bottom:22px;right:22px;z-index:2147483647}button{font:600 13px system-ui;background:#087e6b;color:white;border:1px solid #ffffff66;border-radius:24px;padding:12px 18px;box-shadow:0 4px 20px #0004;cursor:pointer;max-width:310px}button:disabled{opacity:.7}';
  const button = document.createElement('button');
  shadow.append(style, button);
  document.documentElement.append(host);

  async function request(message) {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || 'Falha de comunicação');
    return response.data;
  }
  function context() {
    return {
      id: location.pathname + location.hash, url: location.href,
      title: document.querySelector('.chat-info .peer-title, .ChatInfo .title, .chat-info .title, .topbar .peer-title')?.textContent?.trim() || 'Conversa do Telegram'
    };
  }
  function messages() {
    // Telegram Web A and K: bodies only, never the composer or conversation list.
    const nodes = document.querySelectorAll('.Message .text-content, .bubble .message');
    return [...nodes].slice(-100).filter(node => !node.closest('[contenteditable="true"]'))
      .filter(node => !navigationBaseline.has(node) || navigationBaseline.get(node) !== (node.innerText || node.textContent || ''))
      .map(node => ({ text: node.innerText || node.textContent || '' })).filter(item => item.text.trim());
  }
  async function refresh() {
    if (stopped || busy) return;
    busy = true;
    try {
      const ctx = context();
      const status = await request({ type: 'status' });
      const enabled = Boolean(status.chats[ctx.id]);
      button.disabled = !location.hash.slice(1);
      const label = !location.hash.slice(1) ? 'Radar · Abra uma conversa' : enabled ?
        (status.paused ? 'Radar pausado · Remover conversa' : '✓ No Radar · Parar de monitorar') : '+ Radar · Monitorar esta conversa';
      if (button.textContent !== label) button.textContent = label;
      if (enabled && !status.paused) {
        const batch = messages();
        if (batch.length && context().id === ctx.id) await request({ type: 'scan', ...ctx, messages: batch });
      }
    } catch (error) {
      if (!chrome.runtime?.id) {
        stopped = true; observer.disconnect(); clearInterval(interval); clearTimeout(timer); host.remove();
      } else {
        const label = 'Radar · Recarregue esta página';
        if (button.textContent !== label) button.textContent = label;
        button.title = error.message;
      }
    } finally { busy = false; }
  }
  button.addEventListener('click', async () => {
    button.disabled = true;
    try { await request({ type: 'toggleChat', ...context() }); }
    catch (error) { button.title = error.message; }
    finally { button.disabled = false; await refresh(); }
  });
  const observer = new MutationObserver(records => {
    if (stopped || records.every(record => record.target === host)) return;
    if (!timer) timer = setTimeout(() => { timer = undefined; refresh(); }, 1200);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener('hashchange', () => {
    // Do not attribute the old conversation's still-visible messages to the new URL.
    navigationBaseline = new Map([...document.querySelectorAll('.Message .text-content, .bubble .message')].map(node => [node, node.innerText || node.textContent || '']));
    clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; refresh(); }, 1500);
  });
  const interval = setInterval(refresh, 10000);
  refresh();
})();
