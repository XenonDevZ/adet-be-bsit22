import { db } from '../config/db.js'
import type { FeedbackRow, ResultSetHeader } from '../types/index.js'

export const create = async (data: {
  booking_id:  number
  reviewer_id: number
  reviewee_id: number
  rating:      number
  comment?:    string
}): Promise<FeedbackRow> => {
  // Check if already submitted
  const [existing] = await db.query<FeedbackRow[]>(
    'SELECT id FROM feedback WHERE booking_id = ? AND reviewer_id = ? LIMIT 1',
    [data.booking_id, data.reviewer_id]
  )
  if (existing.length > 0) throw new Error('You have already submitted feedback for this booking')

  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO feedback (booking_id, reviewer_id, reviewee_id, rating, comment)
     VALUES (?, ?, ?, ?, ?)`,
    [data.booking_id, data.reviewer_id, data.reviewee_id,
     data.rating, data.comment ?? null]
  )

  const [rows] = await db.query<FeedbackRow[]>(
    `SELECT f.*, u.name AS reviewer_name
     FROM feedback f
     JOIN users u ON u.id = f.reviewer_id
     WHERE f.id = ?`,
    [result.insertId]
  )
  if (!rows[0]) throw new Error('Failed to create feedback')
  return rows[0]
}

export const findByBooking = async (bookingId: number): Promise<FeedbackRow[]> => {
  const [rows] = await db.query<FeedbackRow[]>(
    `SELECT f.*, u.name AS reviewer_name
     FROM feedback f
     JOIN users u ON u.id = f.reviewer_id
     WHERE f.booking_id = ?
     ORDER BY f.created_at ASC`,
    [bookingId]
  )
  return rows
}

export const hasReviewed = async (bookingId: number, reviewerId: number): Promise<boolean> => {
  const [rows] = await db.query<FeedbackRow[]>(
    'SELECT id FROM feedback WHERE booking_id = ? AND reviewer_id = ? LIMIT 1',
    [bookingId, reviewerId]
  )
  return rows.length > 0
}
