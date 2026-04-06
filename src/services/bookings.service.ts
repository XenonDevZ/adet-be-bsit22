import { db } from '../config/db.js'
import type { BookingRow, BookingStatus, ResultSetHeader } from '../types/index.js'
import * as notifService from './notification.service.js'

// ── Create (student) ──────────────────────────────────────
export const create = async (data: {
  student_id:        number
  teacher_id:        number
  availability_id:   number
  scheduled_date:    string
  start_time:        string
  end_time:          string
  consultation_type: 'ONLINE' | 'FACE_TO_FACE'
  student_notes?:    string
}): Promise<BookingRow> => {
  // Layer 1: teacher conflict check
  const [teacherConflict] = await db.query<BookingRow[]>(`
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

  // Layer 2: student self-conflict check
  const [studentConflict] = await db.query<BookingRow[]>(`
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
  const [result] = await db.query<ResultSetHeader>(`
    INSERT INTO bookings
      (student_id, teacher_id, availability_id, scheduled_date,
       start_time, end_time, consultation_type, student_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.student_id, data.teacher_id, data.availability_id,
    data.scheduled_date, data.start_time, data.end_time,
    data.consultation_type, data.student_notes ?? null,
  ])  

  const booking = await findById(result.insertId)
  if (!booking) throw new Error('Failed to create booking')

  // Notify teacher
  await notifService.create(
    booking.teacher_user_id,
    booking.id,
    `New consultation request from ${booking.student_name} on ${data.scheduled_date}`
  )

  return booking
}

// ── Queries ───────────────────────────────────────────────
export const findByStudent = async (studentId: number): Promise<BookingRow[]> => {
  const [rows] = await db.query<BookingRow[]>(`
    SELECT
      b.*,
      u.name   AS student_name,
      u.email  AS student_email,
      tu.id    AS teacher_user_id,
      tu.name  AS teacher_name
    FROM bookings b
    JOIN users u   ON u.id  = b.student_id
    JOIN teachers t ON t.id = b.teacher_id
    JOIN users tu  ON tu.id = t.user_id
    WHERE b.student_id = ?
    ORDER BY b.scheduled_date DESC, b.start_time DESC
  `, [studentId])
  return rows
}

export const findByTeacher = async (teacherId: number): Promise<BookingRow[]> => {
  const [rows] = await db.query<BookingRow[]>(`
    SELECT
      b.*,
      u.id     AS student_user_id,
      u.name   AS student_name,
      u.email  AS student_email,
      tu.name  AS teacher_name
    FROM bookings b
    JOIN users u   ON u.id  = b.student_id
    JOIN teachers t ON t.id = b.teacher_id
    JOIN users tu  ON tu.id = t.user_id
    WHERE b.teacher_id = ?
    ORDER BY b.scheduled_date DESC, b.start_time DESC
  `, [teacherId])
  return rows
}

export const findAll = async (): Promise<BookingRow[]> => {
  const [rows] = await db.query<BookingRow[]>(`
    SELECT
      b.*,
      u.id     AS student_user_id,
      u.name   AS student_name,
      u.email  AS student_email,
      tu.id    AS teacher_user_id,
      tu.name  AS teacher_name
    FROM bookings b
    JOIN users u   ON u.id  = b.student_id
    JOIN teachers t ON t.id = b.teacher_id
    JOIN users tu  ON tu.id = t.user_id
    ORDER BY b.scheduled_date DESC, b.start_time DESC
  `)
  return rows
}

export const findById = async (id: number): Promise<BookingRow | null> => {
  const [rows] = await db.query<BookingRow[]>(`
    SELECT
      b.*,
      u.id     AS student_user_id,
      u.name   AS student_name,
      u.email  AS student_email,
      tu.id    AS teacher_user_id,
      tu.name  AS teacher_name
    FROM bookings b
    JOIN users u   ON u.id  = b.student_id
    JOIN teachers t ON t.id = b.teacher_id
    JOIN users tu  ON tu.id = t.user_id
    WHERE b.id = ?
    LIMIT 1
  `, [id])
  return rows[0] ?? null
}

// ── Update status ─────────────────────────────────────────
export const updateStatus = async (
  id:        number,
  status:    BookingStatus,
  actorId:   number,
  actorRole: string
): Promise<BookingRow> => {
  const booking = await findById(id)
  if (!booking) throw new Error('Booking not found')

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

  if (isStudent && status === 'CANCELLED' && booking.status !== 'PENDING') {
    throw new Error('You can only cancel pending bookings')
  }

  await db.query<ResultSetHeader>(
    'UPDATE bookings SET status = ? WHERE id = ?',
    [status, id]
  )

  const notifyUserId = isStudent ? booking.teacher_user_id : booking.student_user_id
  await notifService.create(
    notifyUserId,
    id,
    `Your booking on ${booking.scheduled_date} has been ${status.toLowerCase()}.`
  )

  const updated = await findById(id)
  if (!updated) throw new Error('Failed to fetch updated booking')
  return updated
}

// ── Add teacher notes ─────────────────────────────────────
export const addTeacherNotes = async (
  id:        number,
  notes:     string,
  teacherId: number
): Promise<BookingRow> => {
  const booking = await findById(id)
  if (!booking) throw new Error('Booking not found')
  if (booking.teacher_id !== teacherId) throw new Error('Not your booking')
  if (booking.status !== 'COMPLETED') {
    throw new Error('Can only add notes to completed bookings')
  }

  await db.query<ResultSetHeader>(
    'UPDATE bookings SET teacher_notes = ? WHERE id = ?',
    [notes, id]
  )

  const updated = await findById(id)
  if (!updated) throw new Error('Failed to fetch updated booking')
  return updated
}

// Student requests reschedule
export const requestReschedule = async (
  id:        number,
  studentId: number,
  data: {
    reschedule_date:       string
    reschedule_start_time: string
    reschedule_end_time:   string
  }
): Promise<BookingRow> => {
  const booking = await findById(id)
  if (!booking) throw new Error('Booking not found')
  if (booking.student_id !== studentId) throw new Error('Not your booking')
  if (booking.status !== 'PENDING' && booking.status !== 'APPROVED') {
    throw new Error('Can only reschedule pending or approved bookings')
  }

  // Validate new date is not in the past
  if (new Date(data.reschedule_date) < new Date(new Date().toDateString())) {
    throw new Error('Reschedule date cannot be in the past')
  }

  await db.query<ResultSetHeader>(
    `UPDATE bookings
     SET reschedule_date = ?, reschedule_start_time = ?,
         reschedule_end_time = ?, reschedule_status = 'REQUESTED'
     WHERE id = ?`,
    [data.reschedule_date, data.reschedule_start_time, data.reschedule_end_time, id]
  )

  // Notify teacher
  await notifService.create(
    booking.teacher_user_id,
    id,
    `${booking.student_name} requested a reschedule for their booking on ${booking.scheduled_date}`
  )

  const updated = await findById(id)
  if (!updated) throw new Error('Failed to fetch updated booking')
  return updated
}

// Teacher responds to reschedule
export const respondReschedule = async (
  id:        number,
  teacherId: number,
  accept:    boolean
): Promise<BookingRow> => {
  const booking = await findById(id)
  if (!booking) throw new Error('Booking not found')
  if (booking.teacher_id !== teacherId) throw new Error('Not your booking')
  if (booking.reschedule_status !== 'REQUESTED') {
    throw new Error('No reschedule request found for this booking')
  }

  if (accept) {
    // Apply the new schedule and clear reschedule fields
    await db.query<ResultSetHeader>(
      `UPDATE bookings
       SET scheduled_date = reschedule_date,
           start_time = reschedule_start_time,
           end_time = reschedule_end_time,
           reschedule_status = 'ACCEPTED',
           reschedule_date = NULL,
           reschedule_start_time = NULL,
           reschedule_end_time = NULL
       WHERE id = ?`,
      [id]
    )
  } else {
    await db.query<ResultSetHeader>(
      `UPDATE bookings SET reschedule_status = 'REJECTED' WHERE id = ?`,
      [id]
    )
  }

  // Notify student
  const msg = accept
    ? `Your reschedule request for ${booking.scheduled_date} was accepted.`
    : `Your reschedule request for ${booking.scheduled_date} was rejected.`

  await notifService.create(booking.student_user_id, id, msg)

  const updated = await findById(id)
  if (!updated) throw new Error('Failed to fetch updated booking')
  return updated
}
