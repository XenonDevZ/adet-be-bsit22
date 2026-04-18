import { db } from '../config/db.js'
import type { TeacherRow, ResultSetHeader } from '../types/index.js'

export const findAll = async (): Promise<TeacherRow[]> => {
  const [rows] = await db.query<TeacherRow[]>(`
    SELECT
      t.id            AS teacher_id,
      t.department,
      t.bio,
      u.id            AS user_id,
      u.name,
      u.email,
      u.picture
    FROM teachers t
    JOIN users u ON u.id = t.user_id
    ORDER BY u.name ASC
  `)
  return rows
}

export const findById = async (teacherId: number): Promise<TeacherRow | null> => {
  const [rows] = await db.query<TeacherRow[]>(`
    SELECT
      t.id            AS teacher_id,
      t.department,
      t.bio,
      u.id            AS user_id,
      u.name,
      u.email,
      u.picture
    FROM teachers t
    JOIN users u ON u.id = t.user_id
    WHERE t.id = ?
    LIMIT 1
  `, [teacherId])
  return rows[0] ?? null
}

export const findByUserId = async (userId: number): Promise<TeacherRow | null> => {
  const [rows] = await db.query<TeacherRow[]>(
    'SELECT * FROM teachers WHERE user_id = ? LIMIT 1',
    [userId]
  )
  return rows[0] ?? null
}

// Called when admin promotes a user to TEACHER role
export const createProfile = async (
  userId:     number,
  department?: string,
  bio?:        string
): Promise<TeacherRow> => {
  const existing = await findByUserId(userId)
  if (existing) return existing

  const [result] = await db.query<ResultSetHeader>(
    'INSERT INTO teachers (user_id, department, bio) VALUES (?, ?, ?)',
    [userId, department ?? null, bio ?? null]
  )

  const [rows] = await db.query<TeacherRow[]>(
    'SELECT * FROM teachers WHERE id = ?',
    [result.insertId]
  )
  if (!rows[0]) throw new Error('Failed to create teacher profile')
  return rows[0]
}



export const updateProfile = async (
  userId: number,
  data: {
    department: string
    bio?: string | null
  }
): Promise<void> => {
  const [result] = await db.query<ResultSetHeader>(
    'UPDATE teachers SET department = ?, bio = ? WHERE user_id = ?',
    [data.department, data.bio ?? null, userId]
  )
  if (result.affectedRows === 0) throw new Error('Teacher not found')
}
