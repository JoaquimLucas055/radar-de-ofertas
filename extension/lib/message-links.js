// Telegram Web A accepts the official privatepost deep link through tgaddr.
// The -100 prefix identifies a channel/supergroup; basic groups have no equivalent permalink.
export function messageLink(chatId, messageId) {
  const channel = /^-100([1-9][0-9]*)$/.exec(String(chatId));
  if (!channel || !Number.isSafeInteger(messageId) || messageId <= 0 || messageId > 2147483647) return null;
  const deepLink = 'tg://privatepost?channel=' + channel[1] + '&post=' + messageId;
  return 'https://web.telegram.org/a/#?tgaddr=' + encodeURIComponent(deepLink);
}
export function messagePayload(message) {
  return { text: message.message || '', messageId: message.id };
}
