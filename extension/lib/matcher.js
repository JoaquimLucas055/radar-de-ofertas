export function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
export function containsPhrase(text, phrase) {
  const term = normalize(phrase);
  return Boolean(term) && (' ' + normalize(text) + ' ').includes(' ' + term + ' ');
}
export function matchesRule(text, rule) {
  if (!rule.enabled || !normalize(rule.query)) return false;
  return normalize(rule.query).split(' ').every(word => containsPhrase(text, word)) &&
    !(rule.exclude || '').split(',').some(term => containsPhrase(text, term));
}
export function validateRule(input) {
  const query = String(input.query ?? '').trim();
  const exclude = String(input.exclude ?? '').trim();
  if (!normalize(query) || query.length > 120) throw new Error('Informe um produto com até 120 caracteres.');
  if (exclude.length > 240) throw new Error('Use até 240 caracteres nos termos excluídos.');
  return { query, exclude, enabled: input.enabled !== false };
}
export function safeTelegramUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'web.telegram.org' &&
      !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}
export async function eventKey(chatId, text, ruleId) {
  const data = new TextEncoder().encode(JSON.stringify([chatId, text.trim(), ruleId]));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}
