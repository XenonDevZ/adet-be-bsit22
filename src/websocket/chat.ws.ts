import type { IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { verifyJwt } from "../utils/jwt.js";
import * as chatService from "../services/chat.service.js";
import * as bookingsService from "../services/bookings.service.js";
import * as teachersService from "../services/teachers.service.js";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

interface ChatClient {
  ws: WebSocket;
  userId: number;
  userName: string;
  userPicture: string;
  userRole: string;
  bookingId: number;
}

// Map of bookingId → set of connected clients
const rooms = new Map<number, Set<ChatClient>>();

const broadcast = (bookingId: number, data: object, excludeUserId?: number) => {
  const room = rooms.get(bookingId);
  if (!room) return;
  const payload = JSON.stringify(data);
  room.forEach((client) => {
    if (excludeUserId && client.userId === excludeUserId) return;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  });
};

const broadcastAll = (bookingId: number, data: object) => {
  broadcast(bookingId, data);
};

export const setupChatWebSocket = () => {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    // Parse token + bookingId from query string
    const url = new URL(req.url!, `http://localhost`);
    const token = url.searchParams.get("token");
    const bookingId = Number(url.searchParams.get("bookingId"));

    if (!token || !bookingId) {
      console.log("[WS] Rejected: Missing token or bookingId");
      ws.close(1008, "Missing token or bookingId");
      return;
    }

    // Verify JWT
    const payload = verifyJwt(token);
    if (!payload) {
      console.log("[WS] Rejected: Invalid token");
      ws.close(1008, "Invalid token");
      return;
    }

    // Verify booking exists and user is part of it
    const booking = await bookingsService.findById(bookingId);
    if (!booking) {
      console.log("[WS] Rejected: Booking not found", bookingId);
      ws.close(1008, "Booking not found");
      return;
    }

    // Check user is student or teacher of this booking
    let allowed = false;
    if (payload.role === "STUDENT") {
      allowed = booking.student_id === payload.sub;
    } else if (payload.role === "TEACHER") {
      const tp = await teachersService.findByUserId(payload.sub);
      allowed = !!tp && booking.teacher_id === tp.id;
    }

    if (!allowed) {
      console.log("[WS] Rejected: Not authorized -> payload sub:", payload.sub, "role:", payload.role);
      ws.close(1008, "Not authorized for this booking");
      return;
    }

    // Check booking is APPROVED and ONLINE
    if (
      booking.status !== "APPROVED" ||
      booking.consultation_type !== "ONLINE"
    ) {
      console.log("[WS] Rejected: Status != APPROVED or TYPE != ONLINE ->", booking.status, booking.consultation_type);
      ws.close(1008, "Chat not available for this booking");
      return;
    }

    // Check chat is not closed
    if (booking.chat_closed) {
      console.log("[WS] Rejected: Chat is closed");
      ws.close(1008, "Chat is closed");
      return;
    }

    // Check it is time (within 5 min buffer before start)
    // Server is in UTC, we must compare the DB's local time against Philippine Time
    const phTimeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila", hour12: false });
    const nowLocal = new Date(phTimeStr);

    let formattedDate = booking.scheduled_date as any;
    if (formattedDate instanceof Date) {
      const year = formattedDate.getFullYear();
      const month = String(formattedDate.getMonth() + 1).padStart(2, '0');
      const day = String(formattedDate.getDate()).padStart(2, '0');
      formattedDate = `${year}-${month}-${day}`;
    }
    const chatTimeLocal = new Date(`${formattedDate}T${booking.start_time}`);
    chatTimeLocal.setMinutes(chatTimeLocal.getMinutes() - 5);
    
    if (nowLocal < chatTimeLocal) {
      console.log("[WS] Rejected: Too early. chatTimeLocal:", chatTimeLocal, "nowLocal:", nowLocal);
      ws.close(1008, "Chat not yet available");
      return;
    }
    
    console.log("[WS] Authorized user joined chat for booking:", bookingId);

    // Register client
    const client: ChatClient = {
      ws,
      userId: payload.sub,
      userName: payload.name,
      userPicture: payload.picture,
      userRole: payload.role,
      bookingId,
    };

    if (!rooms.has(bookingId)) rooms.set(bookingId, new Set());
    rooms.get(bookingId)!.add(client);


    let history = await chatService.getMessages(bookingId);
    ws.send(JSON.stringify({ type: "history", messages: history }));

    // Notify others user joined
    broadcastAll(bookingId, {
      type: "system",
      message: `${payload.name} joined the chat`,
    });

    // Ping setup
    (ws as any).isAlive = true;
    ws.on('pong', () => {
      (ws as any).isAlive = true;
    });

    // Handle incoming messages
    ws.on("message", async (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        // Text message
        if (data.type === "message" && data.text?.trim()) {
          const saved = await chatService.saveMessage({
            booking_id: bookingId,
            sender_id: payload.sub,
            message: data.text.trim(),
          });
          broadcastAll(bookingId, { type: "message", message: saved });
        }

        // File/image upload (base64)
        if (
          data.type === "file" &&
          data.base64 &&
          data.fileName &&
          data.fileType
        ) {
          const UPLOAD_DIR = "./uploads/chat";
          await mkdir(UPLOAD_DIR, { recursive: true });

          const ext = data.fileName.split(".").pop();
          const saveName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const savePath = join(UPLOAD_DIR, saveName);
          const buffer = Buffer.from(data.base64, "base64");

          await writeFile(savePath, buffer);

          const fileUrl = `/uploads/chat/${saveName}`;
          const saved = await chatService.saveMessage({
            booking_id: bookingId,
            sender_id: payload.sub,
            file_url: fileUrl,
            file_name: data.fileName,
            file_type: data.fileType,
          });
          broadcastAll(bookingId, { type: "message", message: saved });
        }
      } catch (e) {
        console.error("[WS] Message error:", e);
      }
    });

    // Handle disconnect
    ws.on("close", () => {
      rooms.get(bookingId)?.delete(client);
      if (rooms.get(bookingId)?.size === 0) {
        rooms.delete(bookingId);
      }
    });
  });

  // Fast heartbeat to aggressively clean up dead connections and keep proxies alive
  setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 15000);

  console.log("✅  WebSocket chat server ready at /ws/chat");
  return wss;
};

// Called by cron job to force-close a chat room
export const closeRoom = async (bookingId: number) => {
  const room = rooms.get(bookingId);
  if (room) {
    broadcastAll(bookingId, {
      type: "closed",
      message: "Consultation has ended. Chat is now closed.",
    });
    room.forEach((client) => client.ws.close(1000, "Chat closed"));
    rooms.delete(bookingId);
  }
  await chatService.closeChat(bookingId);
};
