import test from 'node:test';
import assert from 'node:assert/strict';
import { seal, unseal } from '../extension/lib/vault.js';
test('sessão é criptografada, autentica senha e detecta adulteração', async () => {
  const secret = { session: 'sessao-privada', apiHash: 'hash-privado' };
  const vault = await seal(secret, 'senha-local-segura');
  assert.ok(!JSON.stringify(vault).includes(secret.session));
  assert.deepEqual(await unseal(vault, 'senha-local-segura'), secret);
  await assert.rejects(unseal(vault, 'outra-senha'), /incorreta/);
  const bytes = Uint8Array.from(atob(vault.data), c => c.charCodeAt(0)); bytes[0] ^= 1;
  await assert.rejects(unseal({ ...vault, data: btoa(String.fromCharCode(...bytes)) }, 'senha-local-segura'));
  await assert.rejects(seal(secret, 'curta'), /10 caracteres/);
});
