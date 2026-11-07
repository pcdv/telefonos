# Telefonos

Audio calls for two to four people who paired once: a static PWA, no build step, no server of its
own. The browsers meet through public Nostr relays (Trystero), then connect directly with WebRTC.
Created 2026-11-07. The README says how it works.

The repository is public: nothing internal goes in a file, a test, a screenshot or a commit
message, and a public history cannot be rewritten. Line endings stay LF.

## Commands

| What | Command |
|---|---|
| Serve the page | `npm run serve` → http://localhost:8092/ |
| Tests | `npm test` |
| Type check | `npx -p typescript tsc -p jsconfig.json` |

Run both before claiming a change works. The type check only knows Trystero through
`web/js/trystero.d.ts`, written by hand: it passes whatever Trystero does, so check an API against
the package's own `types.d.mts` (`npm pack @trystero-p2p/core@<version>`), not against that file.

## Layout

See "Code" in the README. `web/js/lib/` is synced from `../web-lib` (manifest `web-lib.json`):
never edit it; fix in web-lib, then `npm run sync -- ../telefonos/web/js/lib` there.

## Choices

- The room and the password are two different hashes of the secret: the relays see the room.
- The microphone's constraints and the audio element (not Web Audio) are what keep the echo
  canceller working; keep them when touching `call.js`.
- The cap of four is `onPeerHandshake` refusing a fifth. Checked with five headless Chromes (fake
  microphones, the public relays): the four keep three peers each, the fifth none.
- The invitation's QR code was checked by screenshotting it in headless Chrome and decoding it
  with jsQR: it gave back the exact link.
- The icon is a cat with a headset. `icon.svg` is the source; the PNGs (`icon-192`, `icon-512`, the
  maskable one with the cat inside the central 70%, and `apple-touch-icon`) were rendered from it
  in headless Chrome, and the generating script is not kept: redraw the same SVG to change it.
- Not done: push to ring a closed app (it needs a server), reconnection after a change of network (ICE restart).
