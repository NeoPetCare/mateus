import test from 'node:test';
import assert from 'node:assert/strict';

import { cleanText, validEmail, createPasswordHash, passwordMatches } from '../server.js';

test('cleanText remove espaços e limita tamanho', () => {
  assert.equal(cleanText('  Neo Pet  ', 20), 'Neo Pet');
  assert.equal(cleanText('abcdef', 3), 'abc');
});

test('validEmail valida endereços válidos', () => {
  assert.equal(validEmail('usuario@teste.com'), true);
  assert.equal(validEmail('email-invalido'), false);
});

test('hash de senha valida o mesmo valor', async () => {
  const hash = await createPasswordHash('SenhaForte123');
  assert.equal(await passwordMatches('SenhaForte123', hash), true);
  assert.equal(await passwordMatches('SenhaErrada123', hash), false);
});
