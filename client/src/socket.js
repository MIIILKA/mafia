import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "https://mafia-0n4z.onrender.com";
//const SERVER_URL = "http://localhost:4000";
export const socket = io(SERVER_URL, {
  autoConnect: true
});
