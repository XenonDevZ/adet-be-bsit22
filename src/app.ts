import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { env } from "./config/env.js";
import { authRoutes } from "./routes/auth.routes.js";
import { usersRoutes } from "./routes/users.routes.js";
import { teachersRoutes } from "./routes/teachers.routes.js";
import { availabilityRoutes } from "./routes/availability.routes.js";
import { bookingsRoutes } from "./routes/bookings.routes.js";
import { profileRoutes } from "./routes/profile.routes.js";
import { authMiddleware } from "./middleware/auth.js";
import * as chatService from "./services/chat.service.js";
import { err } from "./utils/response.js";

export const app = new Hono();

// ── Global middleware ─────────────────────────────────────
app.use(logger());

app.use(
  "*",
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// ── Health check ──────────────────────────────────────────
app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

// ── Static file serving (chat uploads) ───────────────────
app.use("/uploads/*", serveStatic({ root: "./" }));

// ── Routes ────────────────────────────────────────────────
app.route("/auth", authRoutes);
app.route("/users", usersRoutes);
app.route("/teachers", teachersRoutes);
app.route("/availability", availabilityRoutes);
app.route("/bookings", bookingsRoutes);
app.route("/profile", profileRoutes);

// ── Chat history (REST fallback for reading transcript) ───
app.get("/bookings/:id/chat", authMiddleware, async (c) => {
  try {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) return c.json(err("Invalid booking id"), 400);
    const messages = await chatService.getMessages(id);
    return c.json({ success: true, data: messages });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Failed to get chat history";
    return c.json(err(message), 500);
  }
});

// ── 404 fallback ──────────────────────────────────────────
app.notFound((c) => c.json(err("Route not found"), 404));

// ── Global error handler ──────────────────────────────────
app.onError((e, c) => {
  console.error("[Unhandled Error]", e);
  return c.json(err("Internal server error"), 500);
});
