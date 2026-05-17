import type { RealtimeEvent } from "./types";

type Listener = (e: RealtimeEvent) => void;

const listeners = new Set<Listener>();

let started = false;

let socket: WebSocket | null = null;

function emit(e: RealtimeEvent) {

  listeners.forEach((l) => {

    try {

      l(e);

    } catch {}

  });

}

export const realtime = {

  start() {

    if (started) return;

    started = true;

    try {

      socket = new WebSocket(
        "ws://127.0.0.1:8001/ws"
      );

      socket.onmessage = (event) => {

        try {

          const parsed = JSON.parse(
            event.data
          );

          emit(parsed);

        } catch {}

      };

      socket.onclose = () => {

        socket = null;

      };

    } catch {

      socket = null;

    }

  },

  stop() {

    if (socket) {

      socket.close();

      socket = null;

    }

    started = false;

  },

  subscribe(l: Listener) {

    listeners.add(l);

    this.start();

    return () => {

      listeners.delete(l);

    };

  },

};