import { db } from '../config/db.js'
import type { AvailabilityRow, DayOfWeek, ResultSetHeader } from '../types/index.js'

export const create = async (data: {
  teacher_id:  number
  day_of_week: DayOfWeek
  start_time:  string
  end_time:    string
}): Promise<AvailabilityRow> => {
  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO availability (teacher_id, day_of_week, start_time, end_time)
     VALUES (?, ?, ?, ?)`,
    [data.teacher_id, data.day_of_week, data.start_time, data.end_time]
  )

  const [rows] = await db.query<AvailabilityRow[]>(
    'SELECT * FROM availability WHERE id = ?',
    [result.insertId]
  )
  if (!rows[0]) throw new Error('Failed to create availability slot')
  return rows[0]
}

export const findByTeacher = async (teacherId: number): Promise<AvailabilityRow[]> => {
  const [rows] = await db.query<AvailabilityRow[]>(
    `SELECT * FROM availability
     WHERE teacher_id = ? AND is_active = TRUE
     ORDER BY FIELD(day_of_week,'MON','TUE','WED','THU','FRI','SAT'), start_time`,
    [teacherId]
  )
  return rows
}

export const findById = async (id: number): Promise<AvailabilityRow | null> => {
  const [rows] = await db.query<AvailabilityRow[]>(
    'SELECT * FROM availability WHERE id = ? LIMIT 1',
    [id]
  )
  return rows[0] ?? null
}

export const deactivate = async (id: number, teacherId: number): Promise<void> => {
  const [result] = await db.query<ResultSetHeader>(
    'UPDATE availability SET is_active = FALSE WHERE id = ? AND teacher_id = ?',
    [id, teacherId]
  )
  if (result.affectedRows === 0) {
    throw new Error('Availability slot not found or does not belong to you')
  }
}
