import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "https://mafia-0n4z.onrender.com";

export const socket = io(SERVER_URL, {
  autoConnect: true
});
