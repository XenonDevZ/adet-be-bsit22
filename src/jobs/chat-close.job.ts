import cron from "node-cron";
import { db } from "../config/db.js";
import { closeRoom } from "../websocket/chat.ws.js";
import type { BookingRow } from "../types/index.js";

export const startChatCloseJob = (): void => {
  // Check every minute for consultations that just ended
  cron.schedule("* * * * *", async () => {
    try {
      // Find APPROVED ONLINE bookings whose end_time just passed
      const [bookings] = await db.query<BookingRow[]>(`
        SELECT id FROM bookings
        WHERE status = 'APPROVED'
          AND consultation_type = 'ONLINE'
          AND chat_closed = FALSE
          AND TIMESTAMP(scheduled_date, end_time) <= NOW()
      `);

      for (const booking of bookings) {
        await closeRoom(booking.id);
        // Mark as completed
        await db.query(
          'UPDATE bookings SET status = "COMPLETED" WHERE id = ?',
          [booking.id],
        );
        console.log(`[ChatCloseJob] Closed chat for booking #${booking.id}`);
      }
    } catch (e) {
      console.error("[ChatCloseJob] Error:", e);
    }
  });

  console.log("✅  Chat close job scheduled (every minute)");
};
