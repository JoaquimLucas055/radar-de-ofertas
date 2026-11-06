const encoder = new TextEncoder();
const iterations = 310000;
function encode(bytes) { return btoa(String.fromCharCode(...bytes)); }
function decode(text) { return Uint8Array.from(atob(text), char => char.charCodeAt(0)); }
async function derive(password, salt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function seal(data, password) {
  if (password.length < 10) throw new Error('Use uma senha local com pelo menos 10 caracteres.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(data)));
  return { version: 1, salt: encode(salt), iv: encode(iv), data: encode(new Uint8Array(encrypted)) };
}
export async function unseal(vault, password) {
  if (vault.version !== 1) throw new Error('Formato de sessão desconhecido.');
  try {
    const key = await derive(password, decode(vault.salt));
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(vault.iv) }, key, decode(vault.data));
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch { throw new Error('Senha local incorreta ou sessão danificada.'); }
}
