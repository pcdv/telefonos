# Telefonos

Audio calls between a few people who paired once, with no server of its own. It is a static page
that installs as an app: the calls go from one device to the other, and nothing between them
keeps what is said.

It answers one question: can two to four people who know each other call without an account, a
platform or a server to run? The cost is that both must open the app to call. Nothing rings a
closed one.

## How it works

Pairing happens once. One person adds a contact, which shows the invitation as a QR code: a link
whose fragment holds a random secret (128 bits). The other scans it with the phone's camera, names
the contact, and the pairing is done. When they are not in the same room, the link can be copied
or shared instead. The secret stays in each browser.

A call starts when everyone has opened the app and tapped the contact. The secret gives two
hashes: the name of a room, and the password that seals the session descriptions. Each browser
announces itself in the room through public Nostr relays, which see only the hash and sealed
data. The browsers then connect directly with WebRTC, and the relays are out of it.

The browser does the echo cancellation, the noise suppression and the gain. The microphone is
opened with those three constraints on, and a remote voice is played by an audio element rather
than through a Web Audio graph, so that the echo canceller sees what is played. The codec is Opus.

A call holds four people at most: each sends its voice to each of the others, so the connections
grow with the square of the group. A fifth person who opens the call finds nobody.

## Limits

- Some networks (mobile carriers, strict firewalls) cannot connect two devices directly. Settings
  takes the address and credentials of a TURN relay, kept in the browser. A free tier of a hosted
  one is enough for voice, which uses a few tens of MB an hour, and only for the pairs that need it.
- A phone that locks its screen suspends the page, and the call with it. The page asks for a
  screen wake lock where the browser has one.
- The relays are public and run by others. Any may be down; Trystero uses several at once.
- Whoever has the invitation can join the calls of that contact. To revoke, the admin changes the
  key (see below), or a new contact is made and its invitation sent to those who stay.

## Changing the key

The one who creates a contact is its admin. During a call, only the admin sees "Change the key".
It replaces the secret for the people in the call, and the next call uses the new one. Whoever was
not in the call keeps the old secret and finds nobody: they need a new invitation, which the admin
or any member can show with Invite.

Only the admin can do it because the others check a signature. The creator's device makes a key
pair: the public key travels in the invitation and is kept with each contact, and the private key
stays in IndexedDB, where the page can sign with it but not read it. A change of key is signed with
it and carries the old secret and a counter, so a change made for another contact, or an old one
sent again, is refused.

The admin is bound to the device. If its site data is cleared, nobody can change the key of that
contact any more, and a new contact is needed. A contact made before this existed has no admin.

## Run

Node 21 or later, nothing to install.

```sh
npm run serve        # http://localhost:8092/
npm test
npx -p typescript tsc -p jsconfig.json
```

A microphone needs a secure origin: `localhost` works, a phone on the network does not. Push to
`master` and the page is published by `.github/workflows/pages.yml`, over HTTPS.

## Code

- `web/js/secret.js` — the secret, the invitation link, the room and password derived from it.
- `web/js/admin.js` — the admin's key pair, and the signed change of a secret.
- `web/js/keystore.js` — where the admin's private key is kept (IndexedDB).
- `web/js/contacts.js` — the pairings kept in the browser.
- `web/js/call.js` — the room, the microphone, the streams, the limit of four.
- `web/js/qr.js` — the invitation as a QR code (an SVG).
- `web/js/main.js` — the screens.
- `web/js/lib/` — helpers synced from [web-lib](https://github.com/pcdv/web-lib); fixes are made
  there.
- [Trystero](https://github.com/dmotz/trystero) 0.26.0 and
  [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4, pinned in the import
  map of `web/index.html`, are the dependencies. `web/js/trystero.d.ts` and
  `web/js/qrcode-generator.d.ts` hold the part of their types the page uses.

## License

Apache-2.0.
