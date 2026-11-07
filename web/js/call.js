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
import {derive} from './secret.js';

/** The people in a call, oneself included. */
export const MAX_PEOPLE = 4;

/** @typedef {{id: string, name: string, state: 'connecting' | 'connected'}} Peer */

/**
 * @typedef {object} CallOptions
 * @property {string} secret the pairing
 * @property {string} name what the others see of oneself
 * @property {{urls: string | string[], username?: string, credential?: string}[]} [turn] a relay for the connections that cannot be direct
 * @property {(peers: Peer[]) => void} onPeers called whenever someone joins, leaves or is named
 * @property {(message: string) => void} onProblem
 */

/**
 * @typedef {object} Call
 * @property {() => Promise<void>} leave
 * @property {(muted: boolean) => void} mute
 */

/**
 * @param {CallOptions} options
 * @returns {Promise<Call>} the call, once the microphone is open and the room joined
 */
export async function startCall({secret, name, turn, onPeers, onProblem}) {
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
