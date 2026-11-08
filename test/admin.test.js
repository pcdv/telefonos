import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newAdminKey, signRotation, verifyRotation} from '../web/js/admin.js';
import {newSecret, isSecret} from '../web/js/secret.js';

/** @returns {Promise<{admin: string, secret: string, next: string, sig: string, key: Awaited<ReturnType<typeof newAdminKey>>}>} a pairing and a signed change of its secret */
async function change() {
  const key = await newAdminKey();
  const secret = newSecret();
  const next = newSecret();
  return {key, admin: key.publicKey, secret, next, sig: await signRotation(key.privateKey, secret, 1, next)};
}

test('the public key of an admin fits the invitation, and the private one cannot be read', async () => {
  const {publicKey, privateKey} = await newAdminKey();
  assert.match(publicKey, /^[A-Za-z0-9_-]{86,88}$/);
  assert.equal(privateKey.extractable, false);
  await assert.rejects(crypto.subtle.exportKey('pkcs8', privateKey));
});

test('a change signed by the admin is accepted', async () => {
  const {admin, secret, next, sig} = await change();
  assert.ok(isSecret(next));
  assert.equal(await verifyRotation({admin, secret, epoch: 0}, {secret: next, epoch: 1, sig}), true);
});

test('a change signed by someone else is refused', async () => {
  const {admin, secret, next} = await change();
  const other = await newAdminKey();
  const sig = await signRotation(other.privateKey, secret, 1, next);
  assert.equal(await verifyRotation({admin, secret, epoch: 0}, {secret: next, epoch: 1, sig}), false);
});

test('a change is bound to its pairing, its new secret and its epoch', async () => {
  const {admin, secret, next, sig} = await change();
  assert.equal(await verifyRotation({admin, secret: newSecret(), epoch: 0}, {secret: next, epoch: 1, sig}), false, 'another pairing');
  assert.equal(await verifyRotation({admin, secret, epoch: 0}, {secret: newSecret(), epoch: 1, sig}), false, 'another secret');
  assert.equal(await verifyRotation({admin, secret, epoch: 0}, {secret: next, epoch: 2, sig}), false, 'another epoch');
});

test('an old change sent again is refused', async () => {
  const {admin, secret, next, sig} = await change();
  const received = {secret: next, epoch: 1, sig};
  // the pairing has moved on to the new secret
  assert.equal(await verifyRotation({admin, secret: next, epoch: 1}, received), false);
  // and even if it were back at the old secret, at a later epoch
  assert.equal(await verifyRotation({admin, secret, epoch: 1}, received), false);
});

test('what is not a change is refused', async () => {
  const {admin, secret, next} = await change();
  for (const received of [null, undefined, 'x', 3, {}, {secret: next}, {secret: next, epoch: 1}, {secret: next, epoch: 1.5, sig: 'AAAA'},
    {secret: 'short', epoch: 1, sig: 'AAAA'}, {secret, epoch: 1, sig: 'AAAA'}, {secret: next, epoch: 1, sig: '!!!'}])
    assert.equal(await verifyRotation({admin, secret, epoch: 0}, received), false, JSON.stringify(received));
  assert.equal(await verifyRotation({admin: 'not a key', secret, epoch: 0}, {secret: next, epoch: 1, sig: 'AAAA'}), false);
});
