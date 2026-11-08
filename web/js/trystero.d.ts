// What the page uses of Trystero 0.26 (@trystero-p2p/core's types.d.mts, which the page loads from a
// CDN, see the import map of index.html): for the type check only. When the version is raised, check
// these against the new one.
declare module 'trystero' {
  interface MessageAction<T> {
    send(data: T, options?: {target?: string | string[] | null}): Promise<void>;
    onMessage: ((data: T, context: {peerId: string}) => void | Promise<void>) | null;
  }

  interface Room {
    onPeerJoin: ((peerId: string) => void) | null;
    onPeerLeave: ((peerId: string) => void) | null;
    onPeerStream: ((stream: MediaStream, peerId: string) => void) | null;
    addStream(stream: MediaStream, options?: {target?: string | string[] | null}): Promise<void>[];
    makeAction<T>(namespace: string): MessageAction<T>;
    leave(): Promise<void>;
  }

  interface JoinRoomConfig {
    appId: string;
    password?: string;
    turnConfig?: {urls: string | string[], username?: string, credential?: string}[];
  }

  interface JoinRoomCallbacks {
    onPeerHandshake?: (peerId: string, send: unknown, receive: unknown, isInitiator: boolean) => Promise<void>;
    onJoinError?: (details: {error: string, appId: string, roomId: string, peerId: string}) => void;
  }

  export function joinRoom(config: JoinRoomConfig, roomId: string, callbacks?: JoinRoomCallbacks): Room;
}
