import { db } from '../config/db.js'
import type { BookingFileRow, ResultSetHeader } from '../types/index.js'

export const create = async (data: {
  booking_id: number
  user_id:    number
  file_name:  string
  file_path:  string
  file_type:  string
  file_size:  number
}): Promise<BookingFileRow> => {
  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO booking_files
     (booking_id, user_id, file_name, file_path, file_type, file_size)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.booking_id, data.user_id, data.file_name,
     data.file_path, data.file_type, data.file_size]
  )
  const [rows] = await db.query<BookingFileRow[]>(
    `SELECT bf.*, u.name AS uploader_name
     FROM booking_files bf
     JOIN users u ON u.id = bf.user_id
     WHERE bf.id = ?`,
    [result.insertId]
  )
  if (!rows[0]) throw new Error('Failed to create file record')
  return rows[0]
}

export const findByBooking = async (bookingId: number): Promise<BookingFileRow[]> => {
  const [rows] = await db.query<BookingFileRow[]>(
    `SELECT bf.*, u.name AS uploader_name
     FROM booking_files bf
     JOIN users u ON u.id = bf.user_id
     WHERE bf.booking_id = ?
     ORDER BY bf.uploaded_at DESC`,
    [bookingId]
  )
  return rows
}

export const findById = async (id: number): Promise<BookingFileRow | null> => {
  const [rows] = await db.query<BookingFileRow[]>(
    `SELECT bf.*, u.name AS uploader_name
     FROM booking_files bf
     JOIN users u ON u.id = bf.user_id
     WHERE bf.id = ? LIMIT 1`,
    [id]
  )
  return rows[0] ?? null
}

export const remove = async (id: number, userId: number): Promise<void> => {
  const [result] = await db.query<ResultSetHeader>(
    'DELETE FROM booking_files WHERE id = ? AND user_id = ?',
    [id, userId]
  )
  if (result.affectedRows === 0) {
    throw new Error('File not found or you do not have permission to delete it')
  }
}
