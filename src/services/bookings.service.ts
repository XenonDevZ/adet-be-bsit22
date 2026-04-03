import { db } from '../config/db.js'
import type { BookingStatus } from '../types/index.js'
import * as notifService from './notification.service.js'

// ── Create (student) ──────────────────────────────────────
export const create = async (data: {
  student_id: number
  teacher_id: number
  availability_id: number
  scheduled_date: string   // YYYY-MM-DD
  start_time: string       // HH:MM:SS
  end_time: string         // HH:MM:SS
  student_notes?: string
}) => {
  // Layer 1: teacher conflict
  const [teacherConflict] = await db.query<any[]>(`
    SELECT id FROM bookings
    WHERE teacher_id = ?
      AND scheduled_date = ?
      AND start_time < ?
      AND end_time > ?
      AND status IN ('PENDING','APPROVED')
    LIMIT 1
  `, [data.teacher_id, data.scheduled_date, data.end_time, data.start_time])

  if (teacherConflict.length > 0) {
    throw new Error('This time slot is already booked with this teacher')
  }

  // Layer 2: student self-conflict
  const [studentConflict] = await db.query<any[]>(`
    SELECT id FROM bookings
    WHERE student_id = ?
      AND scheduled_date = ?
      AND start_time < ?
      AND end_time > ?
      AND status IN ('PENDING','APPROVED')
    LIMIT 1
  `, [data.student_id, data.scheduled_date, data.end_time, data.start_time])

  if (studentConflict.length > 0) {
    throw new Error('You already have a booking at this time')
  }

  const [result] = await db.query<any>(`
    INSERT INTO bookings
      (student_id, teacher_id, availability_id, scheduled_date,
       start_time, end_time, student_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    data.student_id, data.teacher_id, data.availability_id,
    data.scheduled_date, data.start_time, data.end_time,
    data.student_notes ?? null
  ])

  const booking = await findById(result.insertId)

  // Notify teacher
  await notifService.create(
    booking.teacher_user_id,
    booking.id,
    `New consultation request from ${booking.student_name} on ${data.scheduled_date}`
  )

  return booking
}

// ── Find all (role-aware query is done in controller) ─────
export const findByStudent = async (studentId: number) => {
  const [rows] = await db.query<any[]>(`
    SELECT
      b.*,
      u.name  AS student_name,
      u.email AS student_email,
      tu.name  AS teacher_name,
      tu.email AS teacher_email
    FROM bookings b
    JOIN users u  ON u.id  = b.student_id
    JOIN teachers t ON t.id = b.teacher_id
    JOIN users tu ON tu.id = t.user_id
    WHERE b.student_id = ?
    ORDER BY b.scheduled_date DESC, b.start_time DESC
  `, [studentId])
  return rows
}

export const findByTeacher = async (teacherId: number) => {
  const [rows] = await db.query<any[]>(`
    SELECT
      b.*,
      u.name  AS student_name,
      u.email AS student_email,
      tu.name  AS teacher_name
    FROM bookings b
    JOIN users u  ON u.id  = b.student_id
    JOIN teachers t ON t.id = b.teacher_id
    JOIN users tu ON tu.id = t.user_id
    WHERE b.teacher_id = ?
    ORDER BY b.scheduled_date DESC, b.start_time DESC
  `, [teacherId])
  return rows
}

export const findAll = async () => {
  const [rows] = await db.query<any[]>(`
    SELECT
      b.*,
      u.name  AS student_name,
      u.email AS student_email,
      tu.name  AS teacher_name
    FROM bookings b
    JOIN users u  ON u.id  = b.student_id
    JOIN teachers t ON t.id = b.teacher_id
    JOIN users tu ON tu.id = t.user_id
    ORDER BY b.scheduled_date DESC, b.start_time DESC
  `)
  return rows
}

export const findById = async (id: number) => {
  const [rows] = await db.query<any[]>(`
    SELECT
      b.*,
      u.id    AS student_user_id,
      u.name  AS student_name,
      u.email AS student_email,
      tu.id   AS teacher_user_id,
      tu.name AS teacher_name
    FROM bookings b
    JOIN users u  ON u.id  = b.student_id
    JOIN teachers t ON t.id = b.teacher_id
    JOIN users tu ON tu.id = t.user_id
    WHERE b.id = ?
    LIMIT 1
  `, [id])
  return rows[0] ?? null
}

// ── Update status ─────────────────────────────────────────
export const updateStatus = async (
  id: number,
  status: BookingStatus,
  actorId: number,
  actorRole: string
) => {
  const booking = await findById(id)
  if (!booking) throw new Error('Booking not found')

  // Permission rules
  const isStudent = actorRole === 'STUDENT' && booking.student_id === actorId
  const isTeacher = actorRole === 'TEACHER'
  const isAdmin   = actorRole === 'ADMIN'

  const allowed: Record<string, BookingStatus[]> = {
    student: ['CANCELLED'],
    teacher: ['APPROVED', 'COMPLETED', 'CANCELLED'],
    admin:   ['APPROVED', 'COMPLETED', 'CANCELLED'],
  }

  const actorKey = isAdmin ? 'admin' : isTeacher ? 'teacher' : 'student'
  if (!allowed[actorKey].includes(status)) {
    throw new Error(`You cannot set status to ${status}`)
  }

  // Students can only cancel PENDING bookings
  if (isStudent && status === 'CANCELLED' && booking.status !== 'PENDING') {
    throw new Error('You can only cancel pending bookings')
  }

  await db.query(
    'UPDATE bookings SET status = ? WHERE id = ?',
    [status, id]
  )

  // Notify the other party
  const notifyUserId = isStudent ? booking.teacher_user_id : booking.student_user_id
  const msg = `Your booking on ${booking.scheduled_date} has been ${status.toLowerCase()}.`
  await notifService.create(notifyUserId, id, msg)

  return findById(id)
}

// ── Add teacher notes ─────────────────────────────────────
export const addTeacherNotes = async (id: number, notes: string, teacherId: number) => {
  const booking = await findById(id)
  if (!booking) throw new Error('Booking not found')
  if (booking.teacher_id !== teacherId) throw new Error('Not your booking')
  if (booking.status !== 'COMPLETED') throw new Error('Can only add notes to completed bookings')

  await db.query(
    'UPDATE bookings SET teacher_notes = ? WHERE id = ?',
    [notes, id]
  )
  return findById(id)
}