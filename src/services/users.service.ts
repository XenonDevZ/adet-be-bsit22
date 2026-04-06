import { db } from '../config/db.js'
import type { Role, UserRow, ResultSetHeader } from '../types/index.js'

export const findByEmail = async (email: string): Promise<UserRow | null> => {
  const [rows] = await db.query<UserRow[]>(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [email]
  )
  return rows[0] ?? null
}

export const findById = async (id: number): Promise<UserRow | null> => {
  const [rows] = await db.query<UserRow[]>(
    'SELECT * FROM users WHERE id = ? LIMIT 1',
    [id]
  )
  return rows[0] ?? null
}

export const create = async (data: {
  google_id: string
  email:     string
  name:      string
  picture:   string
  role:      Role
}): Promise<UserRow> => {
  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO users (google_id, email, name, picture, role)
     VALUES (?, ?, ?, ?, ?)`,
    [data.google_id, data.email, data.name, data.picture, data.role]
  )
  const user = await findById(result.insertId)
  if (!user) throw new Error('Failed to create user')
  return user
}

export const findAll = async (): Promise<UserRow[]> => {
  const [rows] = await db.query<UserRow[]>(
    'SELECT id, email, name, picture, role, created_at FROM users ORDER BY created_at DESC'
  )
  return rows
}

export const updateRole = async (id: number, role: Role): Promise<void> => {
  const [result] = await db.query<ResultSetHeader>(
    'UPDATE users SET role = ? WHERE id = ?',
    [role, id]
  )
  if (result.affectedRows === 0) throw new Error('User not found')
}

export const updateProfile = async (
  id: number,
  data: {
    name:       string
    course:     string
    year_level: string
    department: string
  }
): Promise<UserRow> => {
  const [result] = await db.query<ResultSetHeader>(
    `UPDATE users SET name = ?, course = ?, year_level = ?, department = ?
     WHERE id = ?`,
    [data.name, data.course, data.year_level, data.department, id]
  )
  if (result.affectedRows === 0) throw new Error('User not found')
  const updated = await findById(id)
  if (!updated) throw new Error('Failed to fetch updated user')
  return updated
}
