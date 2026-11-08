// @ts-check
/**
 * The one who created a pairing is its admin: only they can change its secret. A shared secret
 * cannot say "only one of us", so the admin has a key pair. The public key travels in the invitation
 * and is kept with the contact; the private one never leaves the admin's device (keystore.js). A
 * change of secret is a message signed with it, which the others check against the public key.
 *
 * The signature covers the old secret as well as the new one and the epoch: a change made for
 * another pairing, or an old one sent again, is refused.
 */
import {base64url, fromBase64url, isSecret} from './secret.js';

const KEY = {name: 'ECDSA', namedCurve: 'P-256'};
const SIGNATURE = {name: 'ECDSA', hash: 'SHA-256'};

/** @typedef {{secret: string, epoch: number, sig: string}} Rotation the new secret, its epoch, and the admin's signature of them */

/**
 * @returns {Promise<{publicKey: string, privateKey: CryptoKey}>} a new key pair, the private key not extractable
 */
export async function newAdminKey() {
  const pair = await crypto.subtle.generateKey(KEY, false, ['sign', 'verify']);
  return {
    publicKey: base64url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))),
    privateKey: pair.privateKey,
  };
}

/**
 * @param {string} secret the secret in force
 * @param {number} epoch of the new secret
 * @param {string} next the new secret
 * @returns {Uint8Array<ArrayBuffer>} what is signed
 */
function message(secret, epoch, next) {
  return new TextEncoder().encode(`telefonos/rotate/${secret}/${epoch}/${next}`);
}

/**
 * @param {CryptoKey} privateKey
 * @param {string} secret the secret in force
 * @param {number} epoch of the new secret: one more than the one in force
 * @param {string} next the new secret
 * @returns {Promise<string>} the signature, in base64url
 */
export async function signRotation(privateKey, secret, epoch, next) {
  return base64url(new Uint8Array(await crypto.subtle.sign(SIGNATURE, privateKey, message(secret, epoch, next))));
}

/**
 * @param {{admin: string, secret: string, epoch: number}} current the public key of the admin, the secret and the epoch in force
 * @param {unknown} received what a peer sent
 * @returns {Promise<boolean>} whether it is a change by the admin, of this pairing, and newer than the one in force
 */
export async function verifyRotation({admin, secret, epoch}, received) {
  try {
    const r = /** @type {Partial<Rotation> | null} */ (received);
    if (!r || typeof r.secret !== 'string' || typeof r.sig !== 'string' || !Number.isInteger(r.epoch))
      return false;
    if (!isSecret(r.secret) || r.secret === secret || /** @type {number} */ (r.epoch) <= epoch)
      return false;
    const key = await crypto.subtle.importKey('raw', fromBase64url(admin), KEY, false, ['verify']);
    return await crypto.subtle.verify(SIGNATURE, key, fromBase64url(r.sig), message(secret, /** @type {number} */ (r.epoch), r.secret));
  }
  catch (e) {
    return false;
  }
}
