import { db } from "../config/db.js";
import type { ChatMessageRow, ResultSetHeader } from "../types/index.js";

export const saveMessage = async (data: {
  booking_id: number;
  sender_id: number;
  message?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  is_system?: boolean;
}): Promise<ChatMessageRow> => {
  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO chat_messages
     (booking_id, sender_id, message, file_url, file_name, file_type, is_system)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.booking_id,
      data.sender_id,
      data.message ?? null,
      data.file_url ?? null,
      data.file_name ?? null,
      data.file_type ?? null,
      data.is_system ?? false,
    ],
  );

  const [rows] = await db.query<ChatMessageRow[]>(
    `
    SELECT
      cm.*,
      u.name    AS sender_name,
      u.picture AS sender_picture,
      u.role    AS sender_role
    FROM chat_messages cm
    JOIN users u ON u.id = cm.sender_id
    WHERE cm.id = ?
  `,
    [result.insertId],
  );

  if (!rows[0]) throw new Error("Failed to save message");
  return rows[0];
};

export const getMessages = async (
  bookingId: number,
): Promise<ChatMessageRow[]> => {
  const [rows] = await db.query<ChatMessageRow[]>(
    `
    SELECT
      cm.*,
      u.name    AS sender_name,
      u.picture AS sender_picture,
      u.role    AS sender_role
    FROM chat_messages cm
    JOIN users u ON u.id = cm.sender_id
    WHERE cm.booking_id = ?
    ORDER BY cm.created_at ASC
  `,
    [bookingId],
  );
  return rows;
};

export const closeChat = async (bookingId: number): Promise<void> => {
  await db.query<ResultSetHeader>(
    "UPDATE bookings SET chat_closed = TRUE WHERE id = ?",
    [bookingId],
  );
  // Save system message
  await db.query<ResultSetHeader>(
    `INSERT INTO chat_messages (booking_id, sender_id, message, is_system)
     VALUES (?, 1, 'Consultation has ended. Chat is now closed.', TRUE)`,
    [bookingId],
  );
};
