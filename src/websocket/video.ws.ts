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

// Tracks an in-progress call within a room so late joiners get the signal
interface ActiveCall {
  callerName: string;
  callerPicture: string;
  callerPeerId: string;
  callerId: number;
}

// Map of bookingId → set of connected video clients
const videoRooms = new Map<number, Set<VideoClient>>();
// Map of bookingId → active call data (null if no call in progress)
const activeCalls = new Map<number, ActiveCall | null>();

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

    // ── LATE JOINER FIX ──────────────────────────────────────────
    // If there's already an active call in this room, immediately send
    // the call:incoming signal to this new connection so they don't miss it
    const existingCall = activeCalls.get(bookingId);
    if (existingCall && existingCall.callerId !== payload.sub) {
      console.log(`[Video WS] Replaying call:incoming to late-joiner ${payload.name}`);
      ws.send(JSON.stringify({
        type: "call:incoming",
        callerName: existingCall.callerName,
        callerPicture: existingCall.callerPicture,
        callerPeerId: existingCall.callerPeerId,
        callerId: existingCall.callerId,
      }));
    }

    // Ping setup
    (ws as any).isAlive = true;
    ws.on('pong', () => {
      (ws as any).isAlive = true;
    });

    // Handle signaling messages
    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        switch (data.type) {
          case "call:initiate": {
            // Caller sends their peerId, store the active call and broadcast
            client.peerId = data.peerId;
            const callData: ActiveCall = {
              callerName: payload.name,
              callerPicture: payload.picture,
              callerPeerId: data.peerId,
              callerId: payload.sub,
            };
            activeCalls.set(bookingId, callData);

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
            // Callee accepted — clear the pending call state
            client.peerId = data.peerId;
            activeCalls.set(bookingId, null);
            broadcastTo(bookingId, {
              type: "call:accepted",
              accepterName: payload.name,
              accepterPeerId: data.peerId,
              accepterId: payload.sub,
            }, payload.sub);
            break;
          }

          case "call:reject": {
            // Rejected — clear the pending call 
            activeCalls.set(bookingId, null);
            broadcastTo(bookingId, {
              type: "call:rejected",
              rejectorName: payload.name,
            }, payload.sub);
            break;
          }

          case "call:end": {
            // Call ended — clear state
            activeCalls.set(bookingId, null);
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
      videoRooms.get(bookingId)?.delete(client);
      
      const room = videoRooms.get(bookingId);
      if (!room || room.size === 0) {
        videoRooms.delete(bookingId);
        activeCalls.delete(bookingId);
      }

      // Only broadcast call:ended if the CALLER disconnected during an active call
      // This prevents spurious "call ended" when the receiver just reconnects their signaling socket
      const call = activeCalls.get(bookingId);
      const wasCallerInActiveCall = call === null && client.peerId;
      if (wasCallerInActiveCall) {
        broadcastTo(bookingId, {
          type: "call:ended",
          endedBy: payload.name,
        }, payload.sub);
      }

      console.log(`[Video WS] User ${payload.name} left video room for booking ${bookingId}`);
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

  console.log("✅  WebSocket video signaling server ready at /ws/video");
  return wss;
};

