// @ts-check
/**
 * Wiring only: the contacts, the invitation in the address, the call and its screen.
 */
import {h, replace, $} from './lib/dom.js';
import {ask, tell} from './lib/dialog.js';
import {readSetting, writeSetting} from './lib/settings.js';
import {loadContacts, saveContacts, withContact, withoutContact} from './contacts.js';
import {newSecret, inviteLink, parseInvite} from './secret.js';
import {startCall, MAX_PEOPLE} from './call.js';

/** @typedef {import('./call.js').Call} Call */
/** @typedef {import('./call.js').Peer} Peer */

const root = $('app', HTMLElement);
let contacts = loadContacts();
/** @type {{call: Call, contact: import('./contacts.js').Contact, muted: boolean, peers: Peer[]} | null} */
let active = null;

if ('serviceWorker' in navigator)
  navigator.serviceWorker.register('sw.js').catch(() => {});

acceptInvitation().then(show);

/** An invitation opened pairs: it is named, kept, and taken out of the address. */
async function acceptInvitation() {
  const invite = parseInvite(location.hash);
  if (!invite)
    return;
  history.replaceState(null, '', location.pathname + location.search);
  const name = await ask('Name this contact', invite.name);
  if (name)
    update(withContact(contacts, {name: name.trim(), secret: invite.secret}));
}

/** @param {typeof contacts} list */
function update(list) {
  contacts = list;
  saveContacts(contacts);
  show();
}

function show() {
  replace(root, active ? callScreen(active) : home());
}

function home() {
  return [
    h('p', {class: 'hint'}, `Open the app, tap a contact, and ask them to do the same. Up to ${MAX_PEOPLE} people per call.`),
    h('ul', {class: 'contacts'}, contacts.map(c => h('li', null,
      h('span', {class: 'name'}, c.name),
      h('button', {class: 'primary', onclick: () => call(c)}, 'Call'),
      h('button', {onclick: () => invite(c)}, 'Invite'),
      h('button', {onclick: () => remove(c)}, 'Remove')))),
    contacts.length ? null : h('p', {class: 'empty'}, 'No one yet. Add a contact, then send them the invitation.'),
    h('div', {class: 'actions'},
      h('button', {onclick: add}, 'New contact'),
      h('button', {onclick: settings}, 'Settings')),
  ];
}

async function add() {
  const name = await ask('Name of the contact or group');
  if (!name?.trim())
    return;
  const contact = {name: name.trim(), secret: newSecret()};
  update(withContact(contacts, contact));
  await invite(contact);
}

/** @param {import('./contacts.js').Contact} contact */
async function invite(contact) {
  // the one who opens the link names the contact as it is called here, in turn
  const link = inviteLink(location.href, contact.secret, readSetting('telefonos.me') || '');
  if (navigator.share) {
    try {
      await navigator.share({title: 'Telefonos', text: 'Pair with me on Telefonos', url: link});
      return;
    }
    catch (e) {
      // dismissed, or refused: the link is copied instead
    }
  }
  try {
    await navigator.clipboard.writeText(link);
    await tell('The invitation is copied. Send it through a channel you trust: whoever opens it can join your calls.');
  }
  catch (e) {
    await ask('Copy this invitation and send it through a channel you trust', link);
  }
}

/** @param {import('./contacts.js').Contact} contact */
function remove(contact) {
  if (confirm(`Remove ${contact.name}? A new pairing is needed to call again.`))
    update(withoutContact(contacts, contact.secret));
}

async function settings() {
  const me = await ask('Your name, shown to the others', readSetting('telefonos.me') || '');
  if (me === null)
    return;
  writeSetting('telefonos.me', me.trim());
  const url = await ask('TURN relay for networks that block direct calls (turn:host:port), or empty for none', readSetting('telefonos.turn.url') || '');
  if (url === null)
    return;
  writeSetting('telefonos.turn.url', url.trim());
  if (url.trim()) {
    const user = await ask('TURN username', readSetting('telefonos.turn.user') || '');
    const credential = await ask('TURN credential', readSetting('telefonos.turn.credential') || '');
    if (user !== null && credential !== null) {
      writeSetting('telefonos.turn.user', user.trim());
      writeSetting('telefonos.turn.credential', credential.trim());
    }
  }
}

/** @returns {{urls: string, username: string, credential: string}[]} */
function turnServers() {
  const urls = readSetting('telefonos.turn.url');
  return urls ? [{urls, username: readSetting('telefonos.turn.user') || '', credential: readSetting('telefonos.turn.credential') || ''}] : [];
}

/** @param {import('./contacts.js').Contact} contact */
async function call(contact) {
  const state = {contact, muted: false, peers: /** @type {Peer[]} */ ([]), call: /** @type {any} */ (null)};
  try {
    state.call = await startCall({
      secret: contact.secret,
      name: readSetting('telefonos.me') || 'Someone',
      turn: turnServers(),
      onPeers: peers => {
        state.peers = peers;
        if (active === state)
          show();
      },
      onProblem: message => tell(message),
    });
  }
  catch (e) {
    await tell(e instanceof Error && e.name === 'NotAllowedError'
      ? 'The microphone is blocked: allow it for this page, then try again.'
      : `Could not start the call: ${e instanceof Error ? e.message : e}`);
    return;
  }
  active = state;
  show();
}

/** @param {NonNullable<typeof active>} state */
function callScreen(state) {
  return [
    h('h2', null, state.contact.name),
    h('ul', {class: 'peers'}, state.peers.length
      ? state.peers.map(p => h('li', {class: p.state}, h('span', {class: 'name'}, p.name), h('span', {class: 'state'}, p.state)))
      : h('li', {class: 'waiting'}, `Waiting for the others to open the app and call you. If nobody comes, the call may be full (${MAX_PEOPLE} people at most).`)),
    h('div', {class: 'actions'},
      h('button', {onclick: () => {
        state.muted = !state.muted;
        state.call.mute(state.muted);
        show();
      }}, state.muted ? 'Unmute' : 'Mute'),
      h('button', {class: 'danger', onclick: hangUp}, 'Hang up')),
  ];
}

async function hangUp() {
  const state = active;
  active = null;
  show();
  await state?.call.leave();
}
