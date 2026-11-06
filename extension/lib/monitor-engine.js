import { messagePayload } from './message-links.js';
export function peerId(message) {
  const peer = message.peerId;
  if (!peer) return '';
  if (peer.channelId != null) return '-100' + peer.channelId.toString();
  if (peer.chatId != null) return '-' + peer.chatId.toString();
  return peer.userId?.toString() || '';
}
export function channelUrl(id) { return 'https://web.telegram.org/a/#' + id; }
export async function scanRecent(client, selected, ingest, { limit = 100, onProgress = () => {}, stopped = () => false } = {}) {
  // Sequential requests respect server throttling and keep messages with their own channel.
  for (const chat of selected) {
    if (stopped()) break;
    onProgress('Buscando até ' + limit + ' mensagens em ' + chat.title + '…');
    const messages = await client.getMessages(chat.entity, { limit });
    if (stopped()) break;
    await ingest(chat.id, messages.map(messagePayload));
  }
}
