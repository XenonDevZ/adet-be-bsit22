import cron from "node-cron";
import { db } from "../config/db.js";
import { closeRoom } from "../websocket/chat.ws.js";
import type { BookingRow } from "../types/index.js";

export const startChatCloseJob = (): void => {
  // Check every minute for consultations that just ended
  cron.schedule("* * * * *", async () => {
    try {
      // Get exact current time in Asia/Manila, circumventing Vercel/Render UTC clock
      const nowInManila = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
      const pad = (n: number) => String(n).padStart(2, '0');
      const manilaTimestamp = `${nowInManila.getFullYear()}-${pad(nowInManila.getMonth()+1)}-${pad(nowInManila.getDate())} ${pad(nowInManila.getHours())}:${pad(nowInManila.getMinutes())}:${pad(nowInManila.getSeconds())}`;

      // Find ALL APPROVED bookings whose end_time just passed in Manila time
      const [bookings] = await db.query<BookingRow[]>(`
        SELECT id, consultation_type FROM bookings
        WHERE status = 'APPROVED'
          AND TIMESTAMP(scheduled_date, end_time) <= ?
      `, [manilaTimestamp]);

      for (const booking of bookings) {
        if (booking.consultation_type === 'ONLINE') {
          await closeRoom(booking.id);
        }
        // Mark as completed
        await db.query(
          'UPDATE bookings SET status = "COMPLETED", chat_closed = TRUE WHERE id = ?',
          [booking.id],
        );
        console.log(`[AutoCloseJob] Completed booking #${booking.id}`);
      }
    } catch (e) {
      console.error("[ChatCloseJob] Error:", e);
    }
  });

  console.log("✅  Chat close job scheduled (every minute)");
};
