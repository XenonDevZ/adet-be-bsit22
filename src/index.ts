import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./config/env.js";
import "./config/db.js";
import { startReminderJob } from "./jobs/reminder.job.js";
import { startChatCloseJob } from "./jobs/chat-close.job.js";
import { setupChatWebSocket } from "./websocket/chat.ws.js";
import { setupPresenceWebSocket } from "./websocket/presence.ws.js";
import { setupVideoWebSocket } from "./websocket/video.ws.js";
const port = Number(env.PORT);

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`🚀  ACBS API running on http://localhost:${port}`);
  startReminderJob();
  startChatCloseJob();
});

// Attach WebSockets manually to avoid duplicate upgrade event listeners
const chatWss = setupChatWebSocket();
const presenceWss = setupPresenceWebSocket();
const videoWss = setupVideoWebSocket();

// @ts-ignore
server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url!, `http://${request.headers.host}`);
  if (url.pathname === "/ws/chat") {
    chatWss.handleUpgrade(request, socket, head, (ws) => {
      chatWss.emit("connection", ws, request);
    });
  } else if (url.pathname === "/ws/presence") {
    presenceWss.handleUpgrade(request, socket, head, (ws) => {
      presenceWss.emit("connection", ws, request);
    });
  } else if (url.pathname === "/ws/video") {
    videoWss.handleUpgrade(request, socket, head, (ws) => {
      videoWss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});
