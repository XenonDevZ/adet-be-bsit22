import { db } from '../config/db.js'
import type { NotificationRow, ResultSetHeader } from '../types/index.js'

export const create = async (
  userId:    number,
  bookingId: number | null,
  message:   string
): Promise<void> => {
  await db.query<ResultSetHeader>(
    'INSERT INTO notifications (user_id, booking_id, message) VALUES (?, ?, ?)',
    [userId, bookingId, message]
  )
}

export const findUnread = async (userId: number): Promise<NotificationRow[]> => {
  const [rows] = await db.query<NotificationRow[]>(
    `SELECT * FROM notifications
     WHERE user_id = ? AND is_read = FALSE
     ORDER BY created_at DESC`,
    [userId]
  )
  return rows
}

export const markAllRead = async (userId: number): Promise<void> => {
  await db.query<ResultSetHeader>(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
    [userId]
  )
}
