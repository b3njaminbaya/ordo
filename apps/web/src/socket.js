import { io } from "socket.io-client";
import { API_BASE_URL } from "./config";

// The server only accepts authenticated connections and decides which rooms you
// join, so the token is sent on every (re)connect — never cached.
export const socket = io(API_BASE_URL || undefined, {
  transports: ["websocket", "polling"],
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 15000,
  auth: (cb) => cb({ token: localStorage.getItem("access_token") }),
});
