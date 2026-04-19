import { db } from '../config/db.js'
import type { NotificationRow, ResultSetHeader } from '../types/index.js'

const fmtDate = (d: Date | string): string => {
  const date = typeof d === 'string' ? new Date(d + 'T00:00:00') : new Date(d)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

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

export const notifyAdmins = async (
  bookingId: number | null,
  message: string
): Promise<void> => {
  const [admins] = await db.query<any[]>(
    "SELECT id FROM users WHERE role = 'ADMIN'"
  )
  for (const admin of admins) {
    await create(admin.id, bookingId, message)
  }
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

export const findAll = async (userId: number): Promise<NotificationRow[]> => {
  const [rows] = await db.query<NotificationRow[]>(
    `SELECT * FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  )
  return rows
}

export const markRead = async (id: number, userId: number): Promise<void> => {
  await db.query<ResultSetHeader>(
    'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
    [id, userId]
  )
}

export const markAllRead = async (userId: number): Promise<void> => {
  await db.query<ResultSetHeader>(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
    [userId]
  )
}

// Called by the cron job — finds bookings starting in ~30 minutes
// and sends reminders to both student and teacher if not already sent
export const sendUpcomingReminders = async (): Promise<void> => {
  // Find bookings that start in 25-35 minutes (30 min window)
  const [bookings] = await db.query<any[]>(`
    SELECT
      b.id,
      b.scheduled_date,
      b.start_time,
      b.consultation_type,
      b.student_id,
      b.teacher_id,
      u.name  AS student_name,
      tu.id   AS teacher_user_id,
      tu.name AS teacher_name
    FROM bookings b
    JOIN users u    ON u.id  = b.student_id
    JOIN teachers t ON t.id  = b.teacher_id
    JOIN users tu   ON tu.id = t.user_id
    WHERE b.status = 'APPROVED'
      AND TIMESTAMP(b.scheduled_date, b.start_time)
          BETWEEN DATE_ADD(NOW(), INTERVAL 25 MINUTE)
              AND DATE_ADD(NOW(), INTERVAL 35 MINUTE)
  `)

  for (const booking of bookings) {
    const type    = booking.consultation_type === 'ONLINE' ? 'online' : 'face-to-face'
    const timeStr = booking.start_time.slice(0, 5)

    // Notify student
    await create(
      booking.student_id,
      booking.id,
      `⏰ Reminder: Your ${type} consultation with ${booking.teacher_name} starts at ${timeStr} today (${fmtDate(booking.scheduled_date)}).`
    )

    // Notify teacher
    await create(
      booking.teacher_user_id,
      booking.id,
      `⏰ Reminder: Your ${type} consultation with ${booking.student_name} starts at ${timeStr} today (${fmtDate(booking.scheduled_date)}).`
    )
  }

  if (bookings.length > 0) {
    console.log(`[Reminders] Sent ${bookings.length * 2} reminder notifications`)
  }
}
