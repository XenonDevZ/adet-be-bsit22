import { db } from '../config/db.js'
import type { DayOfWeek } from '../types/index.js'

export const create = async (data: {
  teacher_id: number
  day_of_week: DayOfWeek
  start_time: string
  end_time: string
}) => {
  const [result] = await db.query<any>(
    `INSERT INTO availability (teacher_id, day_of_week, start_time, end_time)
     VALUES (?, ?, ?, ?)`,
    [data.teacher_id, data.day_of_week, data.start_time, data.end_time]
  )

  const [rows] = await db.query<any[]>(
    'SELECT * FROM availability WHERE id = ?',
    [result.insertId]
  )
  return rows[0]
}

export const findByTeacher = async (teacherId: number) => {
  const [rows] = await db.query<any[]>(
    `SELECT * FROM availability
     WHERE teacher_id = ? AND is_active = TRUE
     ORDER BY FIELD(day_of_week,'MON','TUE','WED','THU','FRI','SAT'), start_time`,
    [teacherId]
  )
  return rows
}

export const findById = async (id: number) => {
  const [rows] = await db.query<any[]>(
    'SELECT * FROM availability WHERE id = ? LIMIT 1',
    [id]
  )
  return rows[0] ?? null
}

export const deactivate = async (id: number, teacherId: number) => {
  const [result] = await db.query<any>(
    'UPDATE availability SET is_active = FALSE WHERE id = ? AND teacher_id = ?',
    [id, teacherId]
  )
  if (result.affectedRows === 0) throw new Error('Availability slot not found or not yours')
}