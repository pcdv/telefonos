// @ts-check
/**
 * The pairings kept in the browser: a name and a secret each. Losing them (site data cleared) costs
 * a new pairing, nothing more.
 */
import {readSetting, writeSetting} from './lib/settings.js';

/**
 * @typedef {object} Contact
 * @property {string} name
 * @property {string} secret
 * @property {string} [admin] the public key of the one who may change the secret; none for a pairing without one
 * @property {number} [epoch] how many times the secret was changed; none for 0
 */

const KEY = 'telefonos.contacts';

/** @returns {Contact[]} */
export function loadContacts() {
  return parse(readSetting(KEY));
}

/** @param {Contact[]} contacts */
export function saveContacts(contacts) {
  writeSetting(KEY, JSON.stringify(contacts));
}

/**
 * @param {string | null} json what was stored
 * @returns {Contact[]} the contacts in it; none if it is not a list of them
 */
export function parse(json) {
  try {
    const list = JSON.parse(json || '[]');
    return Array.isArray(list)
      ? list.filter(c => c && typeof c.name === 'string' && typeof c.secret === 'string')
        .map(c => ({
          name: c.name,
          secret: c.secret,
          ...(typeof c.admin === 'string' ? {admin: c.admin} : {}),
          ...(Number.isInteger(c.epoch) && c.epoch > 0 ? {epoch: c.epoch} : {}),
        }))
      : [];
  }
  catch (e) {
    return [];
  }
}

/**
 * Adds a contact, or renames the one that holds the same secret: opening an invitation twice pairs
 * once.
 *
 * @param {Contact[]} contacts
 * @param {Contact} contact
 * @returns {Contact[]} a new list
 */
export function withContact(contacts, contact) {
  return contacts.some(c => c.secret === contact.secret)
    ? contacts.map(c => c.secret === contact.secret ? contact : c)
    : [...contacts, contact];
}

/**
 * @param {Contact[]} contacts
 * @param {string} secret the secret that was in force
 * @param {string} next the one that replaces it
 * @param {number} epoch of the new secret
 * @returns {Contact[]} a new list, the contact of the old secret holding the new one
 */
export function withSecret(contacts, secret, next, epoch) {
  return contacts.map(c => c.secret === secret ? {...c, secret: next, epoch} : c);
}

/**
 * @param {Contact[]} contacts
 * @param {string} secret
 * @returns {Contact[]} a new list, without the contact of this secret
 */
export function withoutContact(contacts, secret) {
  return contacts.filter(c => c.secret !== secret);
}
