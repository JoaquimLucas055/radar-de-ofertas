import { messagePayload } from './message-links.js';
export function peerId(message) {
  const peer = message.peerId;
  if (!peer) return '';
  if (peer.channelId != null) return '-100' + peer.channelId.toString();
  if (peer.chatId != null) return '-' + peer.chatId.toString();
  return peer.userId?.toString() || '';
}
export function channelUrl(id) { return 'https://web.telegram.org/a/#' + id; }
export async function scanRecent(client, selected, ingest, {
  limit = 100, queries = [], onProgress = () => {}, stopped = () => false
} = {}) {
  const searches = queries.length ? [...new Set(queries.map(query => query.trim()).filter(Boolean))] : [null];
  const report = { rows: [], messages: 0, textMessages: 0, matched: 0, found: 0, restored: 0, cancelled: false };
  for (const chat of selected) {
    for (const query of searches) {
      if (stopped()) { report.cancelled = true; return report; }
      onProgress(query ? 'Procurando “' + query + '” no histórico de ' + chat.title + '…' :
        'Buscando até ' + limit + ' mensagens recentes em ' + chat.title + '…');
      const messages = await client.getMessages(chat.entity, { limit, ...(query ? { search: query } : {}) });
      if (stopped()) { report.cancelled = true; return report; }
      const batch = messages.map(messagePayload);
      const result = await ingest(chat.id, batch);
      const row = {
        chat: chat.title, query, messages: batch.length, textMessages: batch.filter(item => item.text.trim()).length,
        matched: result?.matched || 0, found: result?.found || 0, restored: result?.restored || 0, skipped: result?.skipped || null
      };
      report.rows.push(row);
      for (const field of ['messages', 'textMessages', 'matched', 'found', 'restored']) report[field] += row[field];
    }
  }
  return report;
}
