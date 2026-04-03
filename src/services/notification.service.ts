import { db } from '../config/db.js'

export const create = async (userId: number, bookingId: number | null, message: string) => {
  await db.query(
    'INSERT INTO notifications (user_id, booking_id, message) VALUES (?, ?, ?)',
    [userId, bookingId, message]
  )
}

export const findUnread = async (userId: number) => {
  const [rows] = await db.query<any[]>(
    `SELECT * FROM notifications
     WHERE user_id = ? AND is_read = FALSE
     ORDER BY created_at DESC`,
    [userId]
  )
  return rows
}

export const markAllRead = async (userId: number) => {
  await db.query(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
    [userId]
  )
}