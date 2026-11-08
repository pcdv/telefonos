// @ts-check
/**
 * A call: the room of a pairing, joined through public Nostr relays (Trystero), then a direct WebRTC
 * connection to each of the others, which the relays no longer see. Audio only, one stream each way
 * per pair, which is why a call stops at four people: each sends its voice to the three others.
 *
 * The browser does the echo cancellation, the noise suppression and the gain (the constraints of
 * the microphone below); a remote voice is played by an audio element, not through a Web Audio
 * graph, so that the echo canceller has what is being played to subtract.
 */
import {joinRoom} from 'trystero';
import {derive, newSecret} from './secret.js';
import {signRotation, verifyRotation} from './admin.js';

/** The people in a call, oneself included. */
export const MAX_PEOPLE = 4;

/** @typedef {{id: string, name: string, state: 'connecting' | 'connected'}} Peer */

/**
 * @typedef {object} CallOptions
 * @property {string} secret the pairing
 * @property {string} name what the others see of oneself
 * @property {{urls: string | string[], username?: string, credential?: string}[]} [turn] a relay for the connections that cannot be direct
 * @property {string} [admin] the public key of the admin of the pairing, if it has one
 * @property {number} [epoch] how many times the secret was changed
 * @property {CryptoKey | null} [adminKey] the private key, when this device is the admin
 * @property {(secret: string, epoch: number) => void} [onRotated] called when the secret changed: the next call uses the new one
 * @property {(peers: Peer[]) => void} onPeers called whenever someone joins, leaves or is named
 * @property {(message: string) => void} onProblem
 */

/**
 * @typedef {object} Call
 * @property {() => Promise<void>} leave
 * @property {(muted: boolean) => void} mute
 * @property {(() => Promise<{changed: number, of: number}>) | null} rotate changes the secret for the people in the call; null unless this device is the admin
 */

/** How long the admin waits for the others to confirm a change of secret. */
const ROTATION_WAIT_MS = 5000;

/**
 * @param {CallOptions} options
 * @returns {Promise<Call>} the call, once the microphone is open and the room joined
 */
export async function startCall({secret, name, turn, admin, epoch, adminKey, onRotated, onPeers, onProblem}) {
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1},
    video: false,
  });
  const {room: roomId, password} = await derive(secret);

  /** @type {Map<string, Peer>} */
  const peers = new Map();
  /** @type {Map<string, HTMLAudioElement>} */
  const audios = new Map();
  const changed = () => onPeers([...peers.values()]);

  const room = joinRoom({
    appId: 'telefonos',
    password,
    ...(turn?.length ? {turnConfig: turn} : {}),
  }, roomId, {
    // the room holds MAX_PEOPLE: whoever comes after is refused, at both ends
    onPeerHandshake: async () => {
      if (peers.size >= MAX_PEOPLE - 1)
        throw new Error('the call is full');
    },
    onJoinError: details => onProblem(`Could not connect to a peer: ${details.error}. A relay (TURN) may be needed on this network.`),
  });

  const names = room.makeAction('name');
  names.onMessage = (received, {peerId}) => {
    const peer = peers.get(peerId);
    if (peer && typeof received === 'string') {
      peer.name = received.slice(0, 40);
      changed();
    }
  };

  // The secret can be changed during the call, by the admin only: the others check the signature.
  // The call goes on in the room it started in; the change is for the next one.
  let current = {secret, epoch: epoch ?? 0};
  /** @type {((epoch: number, peerId: string) => void) | null} */
  let onAck = null;
  const rotations = room.makeAction('rotate');
  const acks = room.makeAction('rotated');
  rotations.onMessage = async (received, {peerId}) => {
    if (!admin || !await verifyRotation({admin, ...current}, received))
      return;
    const {secret: next, epoch: nextEpoch} = /** @type {import('./admin.js').Rotation} */ (received);
    current = {secret: next, epoch: nextEpoch};
    onRotated?.(next, nextEpoch);
    acks.send(nextEpoch, {target: peerId});
  };
  acks.onMessage = (received, {peerId}) => {
    if (typeof received === 'number')
      onAck?.(received, peerId);
  };

  room.onPeerJoin = id => {
    peers.set(id, {id, name: 'Someone', state: 'connecting'});
    room.addStream(mic, {target: id});
    names.send(name, {target: id});
    changed();
  };
  room.onPeerLeave = id => {
    peers.delete(id);
    const audio = audios.get(id);
    if (audio)
      audio.srcObject = null;
    audios.delete(id);
    changed();
  };
  room.onPeerStream = (stream, id) => {
    const audio = new Audio();
    audio.autoplay = true;
    audio.srcObject = stream;
    audios.set(id, audio);
    const peer = peers.get(id);
    if (peer) {
      peer.state = 'connected';
      changed();
    }
  };

  const wake = await keepAwake();

  return {
    mute: muted => mic.getAudioTracks().forEach(t => t.enabled = !muted),
    rotate: adminKey ? async () => {
      const targets = [...peers.keys()];
      if (!targets.length)
        throw new Error('nobody is in the call to be told');
      const next = newSecret();
      const nextEpoch = current.epoch + 1;
      const sig = await signRotation(adminKey, current.secret, nextEpoch, next);
      const acked = new Set();
      /** @type {ReturnType<typeof setTimeout> | undefined} */
      let timer;
      const everyone = new Promise(resolve => {
        timer = setTimeout(resolve, ROTATION_WAIT_MS);
        onAck = (e, id) => {
          if (e === nextEpoch)
            acked.add(id);
          if (targets.every(t => acked.has(t)))
            resolve(undefined);
        };
      });
      await rotations.send({secret: next, epoch: nextEpoch, sig}, {target: targets});
      // the admin is the source of the change: it holds the new secret whoever did not hear it
      current = {secret: next, epoch: nextEpoch};
      onRotated?.(next, nextEpoch);
      await everyone;
      clearTimeout(timer);
      onAck = null;
      return {changed: acked.size, of: targets.length};
    } : null,
    async leave() {
      wake.release();
      await room.leave();
      mic.getTracks().forEach(t => t.stop());
      audios.forEach(a => a.srcObject = null);
      audios.clear();
      peers.clear();
      changed();
    },
  };
}

/**
 * Keeps the screen on during the call: a phone that locks suspends the page, and the call with it.
 * Where the browser has no wake lock, or refuses it, the call goes on without.
 *
 * @returns {Promise<{release: () => void}>}
 */
async function keepAwake() {
  /** @type {any} */
  let lock = null;
  let released = false;
  const acquire = async () => {
    try {
      lock = await (/** @type {any} */ (navigator)).wakeLock?.request('screen');
    }
    catch (e) {
      lock = null;
    }
  };
  // a lock is dropped when the page is hidden: asked for again when it is shown
  const again = () => {
    if (!released && document.visibilityState === 'visible')
      acquire();
  };
  document.addEventListener('visibilitychange', again);
  await acquire();
  return {
    release() {
      released = true;
      document.removeEventListener('visibilitychange', again);
      lock?.release().catch(() => {});
    },
  };
}
