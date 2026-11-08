// @ts-check
/**
 * What a pairing is: a random secret that two or more people hold, nothing else. The call finds its
 * way from it (the relays only ever see a hash of it), and only a holder of it can complete one.
 *
 * It travels in the fragment of a link, which a browser never sends to a server.
 */

/** 16 random bytes, in base64url: 22 characters. */
const SECRET = /^[A-Za-z0-9_-]{22,64}$/;

/** The public key of the admin of a pairing: 65 bytes (a P-256 point), 87 characters. */
const ADMIN = /^[A-Za-z0-9_-]{80,100}$/;

/**
 * @param {Uint8Array} bytes
 * @returns {string} base64url, without padding
 */
export function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/**
 * @param {string} text base64url
 * @returns {Uint8Array<ArrayBuffer>}
 */
export function fromBase64url(text) {
  const padded = text.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

/** @returns {string} a new secret, 128 bits */
export function newSecret() {
  return base64url(crypto.getRandomValues(new Uint8Array(16)));
}

/**
 * @param {string} secret
 * @returns {boolean} whether it looks like one
 */
export function isSecret(secret) {
  return SECRET.test(secret);
}

/**
 * @param {string} base the address of the page
 * @param {string} secret
 * @param {string} name what the contact is called, for the one who opens the link
 * @param {string} [admin] the public key of the one who may change the secret (see admin.js)
 * @returns {string} the link that pairs whoever opens it
 */
export function inviteLink(base, secret, name, admin) {
  return `${base.split('#')[0]}#join=${secret}&name=${encodeURIComponent(name)}${admin ? `&admin=${admin}` : ''}`;
}

/**
 * @param {string} hash the fragment of the address of the page
 * @returns {{secret: string, name: string, admin?: string} | null} what an invitation holds; null if the fragment is not one
 */
export function parseInvite(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const secret = params.get('join');
  if (!secret || !isSecret(secret))
    return null;
  const admin = params.get('admin');
  return {
    secret,
    name: (params.get('name') || '').trim().slice(0, 40),
    ...(admin && ADMIN.test(admin) ? {admin} : {}),
  };
}

/**
 * The relays are public, so what they see is a hash. The password that seals what the peers tell
 * each other there is another hash: the room tells nothing of it.
 *
 * @param {string} secret
 * @returns {Promise<{room: string, password: string}>} the room to meet in, and the password of the room
 */
export async function derive(secret) {
  const [room, password] = await Promise.all([hash('room', secret), hash('key', secret)]);
  return {room, password};
}

/**
 * @param {string} label what the hash is for
 * @param {string} secret
 * @returns {Promise<string>} 128 bits of SHA-256, in hex
 */
async function hash(label, secret) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`telefonos/${label}/${secret}`));
  return [...new Uint8Array(digest).slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
}
