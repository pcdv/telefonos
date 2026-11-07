import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newSecret, isSecret, inviteLink, parseInvite, derive} from '../web/js/secret.js';

test('a new secret is 22 characters of base64url and never the same twice', () => {
  const a = newSecret();
  assert.match(a, /^[A-Za-z0-9_-]{22}$/);
  assert.ok(isSecret(a));
  assert.notEqual(a, newSecret());
});

test('what is not a secret is refused', () => {
  for (const s of ['', 'short', 'has space has space 12', 'a'.repeat(65), '../../etc/passwd/xxxxxxx'])
    assert.equal(isSecret(s), false, s);
});

test('an invitation is read back, whatever the name holds', () => {
  const secret = newSecret();
  const link = inviteLink('https://example.org/telefonos/?x=1#old', secret, 'Zoë & co=1');
  assert.ok(link.startsWith('https://example.org/telefonos/?x=1#join='));
  assert.deepEqual(parseInvite(new URL(link).hash), {secret, name: 'Zoë & co=1'});
});

test('a fragment that is not an invitation is ignored', () => {
  assert.equal(parseInvite(''), null);
  assert.equal(parseInvite('#section'), null);
  assert.equal(parseInvite('#join=short'), null);
});

test('the room and the password are stable, distinct, and tell nothing of the secret', async () => {
  const secret = newSecret();
  const a = await derive(secret);
  assert.deepEqual(a, await derive(secret));
  assert.notEqual(a.room, a.password);
  assert.match(a.room, /^[0-9a-f]{32}$/);
  assert.ok(!a.room.includes(secret) && !a.password.includes(secret));
  assert.notEqual((await derive(newSecret())).room, a.room);
});
