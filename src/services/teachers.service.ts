import { db } from '../config/db.js'

export const findAll = async () => {
  const [rows] = await db.query<any[]>(`
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

export const findById = async (teacherId: number) => {
  const [rows] = await db.query<any[]>(`
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

export const findByUserId = async (userId: number) => {
  const [rows] = await db.query<any[]>(
    'SELECT * FROM teachers WHERE user_id = ? LIMIT 1',
    [userId]
  )
  return rows[0] ?? null
}

// Called when admin promotes a user to TEACHER role
export const createProfile = async (userId: number, department?: string, bio?: string) => {
  const existing = await findByUserId(userId)
  if (existing) return existing

  const [result] = await db.query<any>(
    'INSERT INTO teachers (user_id, department, bio) VALUES (?, ?, ?)',
    [userId, department ?? null, bio ?? null]
  )

  const [rows] = await db.query<any[]>(
    'SELECT * FROM teachers WHERE id = ?',
    [result.insertId]
  )
  return rows[0]
}