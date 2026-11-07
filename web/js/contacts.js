// @ts-check
/**
 * The pairings kept in the browser: a name and a secret each. Losing them (site data cleared) costs
 * a new pairing, nothing more.
 */
import {readSetting, writeSetting} from './lib/settings.js';

/** @typedef {{name: string, secret: string}} Contact */

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
        .map(c => ({name: c.name, secret: c.secret}))
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
 * @param {string} secret
 * @returns {Contact[]} a new list, without the contact of this secret
 */
export function withoutContact(contacts, secret) {
  return contacts.filter(c => c.secret !== secret);
}
