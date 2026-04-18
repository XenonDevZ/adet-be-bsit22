import type { IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { verifyJwt } from "../utils/jwt.js";
import * as bookingsService from "../services/bookings.service.js";
import * as teachersService from "../services/teachers.service.js";

interface VideoClient {
  ws: WebSocket;
  userId: number;
  userName: string;
  userPicture: string;
  userRole: string;
  bookingId: number;
  peerId?: string;
}

// Map of bookingId → set of connected video clients
const videoRooms = new Map<number, Set<VideoClient>>();

const broadcastTo = (bookingId: number, data: object, excludeUserId?: number) => {
  const room = videoRooms.get(bookingId);
  if (!room) return;
  const payload = JSON.stringify(data);
  room.forEach((client) => {
    if (excludeUserId && client.userId === excludeUserId) return;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  });
};

export const setupVideoWebSocket = () => {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url!, `http://localhost`);
    const token = url.searchParams.get("token");
    const bookingId = Number(url.searchParams.get("bookingId"));

    if (!token || !bookingId) {
      ws.close(1008, "Missing token or bookingId");
      return;
    }

    const payload = verifyJwt(token);
    if (!payload) {
      ws.close(1008, "Invalid token");
      return;
    }

    // Verify booking exists and user is part of it
    const booking = await bookingsService.findById(bookingId);
    if (!booking) {
      ws.close(1008, "Booking not found");
      return;
    }

    let allowed = false;
    if (payload.role === "STUDENT") {
      allowed = booking.student_id === payload.sub;
    } else if (payload.role === "TEACHER") {
      const tp = await teachersService.findByUserId(payload.sub);
      allowed = !!tp && booking.teacher_id === tp.id;
    }

    if (!allowed) {
      ws.close(1008, "Not authorized for this booking");
      return;
    }

    if (booking.status !== "APPROVED" || booking.consultation_type !== "ONLINE") {
      ws.close(1008, "Video call not available for this booking");
      return;
    }

    console.log(`[Video WS] User ${payload.name} joined video room for booking ${bookingId}`);

    const client: VideoClient = {
      ws,
      userId: payload.sub,
      userName: payload.name,
      userPicture: payload.picture,
      userRole: payload.role,
      bookingId,
    };

    if (!videoRooms.has(bookingId)) videoRooms.set(bookingId, new Set());
    videoRooms.get(bookingId)!.add(client);

    // Let the client know they're connected
    ws.send(JSON.stringify({ type: "connected", userId: payload.sub }));

    // Handle signaling messages
    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        switch (data.type) {
          case "call:initiate": {
            // Caller sends their peerId, broadcast to the other party
            client.peerId = data.peerId;
            broadcastTo(bookingId, {
              type: "call:incoming",
              callerName: payload.name,
              callerPicture: payload.picture,
              callerPeerId: data.peerId,
              callerId: payload.sub,
            }, payload.sub);
            break;
          }

          case "call:accept": {
            // Callee accepted, send their peerId back to caller
            client.peerId = data.peerId;
            broadcastTo(bookingId, {
              type: "call:accepted",
              accepterName: payload.name,
              accepterPeerId: data.peerId,
              accepterId: payload.sub,
            }, payload.sub);
            break;
          }

          case "call:reject": {
            broadcastTo(bookingId, {
              type: "call:rejected",
              rejectorName: payload.name,
            }, payload.sub);
            break;
          }

          case "call:end": {
            broadcastTo(bookingId, {
              type: "call:ended",
              endedBy: payload.name,
            }, payload.sub);
            break;
          }

          default:
            break;
        }
      } catch (e) {
        console.error("[Video WS] Message error:", e);
      }
    });

    // Handle disconnect
    ws.on("close", () => {
      // Notify other party that this user's video connection dropped
      broadcastTo(bookingId, {
        type: "call:ended",
        endedBy: payload.name,
      }, payload.sub);

      videoRooms.get(bookingId)?.delete(client);
      if (videoRooms.get(bookingId)?.size === 0) {
        videoRooms.delete(bookingId);
      }
      console.log(`[Video WS] User ${payload.name} left video room for booking ${bookingId}`);
    });
  });

  console.log("✅  WebSocket video signaling server ready at /ws/video");
  return wss;
};
