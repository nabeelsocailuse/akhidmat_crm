import { io } from "socket.io-client";

const socket = io("http://192.168.10.136:9000", {
  transports: ["websocket"], // ensures WS, not polling
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

// Log when connected
socket.on("connect", () => {
  console.log(`✅ Socket connected: ${socket.id}`);
});

// Log when disconnected
socket.on("disconnect", () => {
  console.log("❌ Socket disconnected");
});

export default socket;
 