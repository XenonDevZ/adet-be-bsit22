import type { IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { verifyJwt } from "../utils/jwt.js";

interface PresenceClient {
  ws: WebSocket;
  userId: number;
}

// Global presence tracker: Map<userId, Set<WebSocket>>
const onlineUsers = new Map<number, Set<WebSocket>>();

const broadcastToAll = (data: object) => {
  const payload = JSON.stringify(data);
  for (const connections of onlineUsers.values()) {
    for (const ws of connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
};

export const setupPresenceWebSocket = () => {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    try {
      const url = new URL(req.url!, `http://localhost`);
      const token = url.searchParams.get("token");

      if (!token) {
        ws.close(1008, "Missing token");
        return;
      }

      const payload = verifyJwt(token);
      if (!payload) {
        ws.close(1008, "Invalid token");
        return;
      }

      const userId = payload.sub;

      // Add user to online tracking
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
        // User just came online, broadcast to everyone else
        broadcastToAll({ type: "online", userId });
      }
      onlineUsers.get(userId)!.add(ws);

      // Send initial state to the connecting client
      ws.send(
        JSON.stringify({
          type: "init",
          activeUserIds: Array.from(onlineUsers.keys()),
        })
      );

      // Heartbeat & keepalive (optional but good practice)
      ws.on("message", (msg) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
          }
        } catch (e) {
          // ignore parsing error
        }
      });

      // Cleanup on disconnect
      ws.on("close", () => {
        const userConnections = onlineUsers.get(userId);
        if (userConnections) {
          userConnections.delete(ws);
          if (userConnections.size === 0) {
            onlineUsers.delete(userId);
            // User went offline, broadcast to everyone else
            broadcastToAll({ type: "offline", userId });
          }
        }
      });
    } catch (e) {
      console.error("[Presence WS] Connection error:", e);
      ws.close(1011, "Internal Server Error");
    }
  });

  console.log("✅  WebSocket presence server ready at /ws/presence");
  return wss;
};
