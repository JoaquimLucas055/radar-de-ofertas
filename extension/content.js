(() => {
  if (window.top !== window) return;
  let stopped = false, reading = false, changing = false;
  let route = '', readyAt = 0;
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = ':host{position:fixed;bottom:22px;right:22px;z-index:2147483647;font:13px system-ui}button{font:600 13px system-ui;background:#087e6b;color:white;border:1px solid #ffffff66;border-radius:24px;padding:12px 18px;box-shadow:0 4px 20px #0004;cursor:pointer;max-width:310px}button:disabled{opacity:.7}.info{max-width:310px;background:white;color:#23483b;padding:9px 12px;border-radius:8px;margin-top:6px;white-space:pre-line;overflow-wrap:anywhere}';
  const button = document.createElement('button');
  const info = document.createElement('div');
  info.className = 'info'; info.setAttribute('role', 'status');
  shadow.append(style, button, info);
  document.documentElement.append(host);
  function context() {
    const title = document.querySelector('.chat-info .peer-title, .ChatInfo .title, .chat-info .title, .topbar .peer-title')?.textContent?.trim() || 'Conversa do Telegram';
    return { id: location.pathname + location.hash, url: location.href, title };
  }
  function setText(node, value) { if (node.textContent !== value) node.textContent = value; }
  function observeRoute() {
    const id = context().id;
    if (id !== route) {
      route = id;
      readyAt = Date.now() + 1500;
      setText(button, 'Radar · Trocando de conversa…');
      button.disabled = true;
      setText(info, 'Aguardando a conversa carregar.');
    }
  }
  async function request(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || 'Falha de comunicação');
    return result.data;
  }
  function messages() {
    // Never retain a blacklist of nodes: Telegram may reuse nodes across conversations.
    return [...document.querySelectorAll('.Message .text-content, .bubble .message')]
      .filter(node => node.getClientRects().length && !node.closest('[contenteditable="true"]'))
      .slice(-100).map(node => ({ text: node.innerText || node.textContent || '' }))
      .filter(item => item.text.trim());
  }
  function report(error) {
    setText(info, error.message + '\nSe você atualizou a extensão, recarregue o Telegram.');
  }
  async function refresh() {
    if (stopped) return;
    observeRoute();
    if (reading || changing || Date.now() < readyAt) return;
    reading = true;
    const ctx = context();
    try {
      const status = await request({ type: 'status' });
      if (context().id !== ctx.id) return;
      const enabled = Boolean(status.chats[ctx.id]);
      button.disabled = !location.hash.slice(1);
      setText(button, !location.hash.slice(1) ? 'Radar · Abra uma conversa' :
        enabled ? '✓ No Radar · Parar de monitorar' : '+ Radar · Monitorar esta conversa');
      setText(info, ctx.title + (status.paused ? '\nRadar pausado no painel.' : enabled ? '\nLendo mensagens carregadas…' : '\nEsta conversa ainda não está sendo monitorada.'));
      if (enabled && !status.paused) {
        const batch = messages();
        if (context().id !== ctx.id) return;
        await request({ type: 'scan', ...ctx, messages: batch });
        if (context().id === ctx.id) setText(info, ctx.title + '\n' + batch.length + ' mensagem(ns) carregada(s) nesta leitura.');
      }
    } catch (error) {
      if (!chrome.runtime?.id) { stopped = true; clearInterval(interval); }
      report(error);
    } finally {
      reading = false;
      if (context().id !== ctx.id) observeRoute();
    }
  }
  button.addEventListener('click', async () => {
    observeRoute();
    if (changing || Date.now() < readyAt) return;
    changing = true; button.disabled = true;
    const ctx = context();
    let succeeded = false;
    try {
      // Use an explicit target state, so retries cannot accidentally remove a chat.
      const status = await request({ type: 'status' });
      if (context().id !== ctx.id) return;
      await request({ type: 'toggleChat', ...ctx, monitoring: !Boolean(status.chats[ctx.id]) });
      succeeded = true;
    } catch (error) { report(error); }
    finally { changing = false; if (succeeded) await refresh(); }
  });
  // Polling also catches history.replaceState, which does not emit hashchange.
  const interval = setInterval(refresh, 2000);
  window.addEventListener('hashchange', () => { observeRoute(); refresh(); });
  refresh();
})();
