import type { Context } from 'hono'
import * as bookingsService from '../services/bookings.service.js'
import * as teachersService from '../services/teachers.service.js'
import * as availabilityService from '../services/availability.service.js'
import * as notifService from '../services/notification.service.js'
import { ok, err } from '../utils/response.js'
import type { BookingStatus } from '../types/index.js'

// POST /bookings  (student)
export const createBooking = async (c: Context) => {
  try {
    const jwtUser = c.get('user')

    const { teacher_id, availability_id, scheduled_date, start_time, end_time, notes } =
      await c.req.json() as {
        teacher_id:      number
        availability_id: number
        scheduled_date:  string
        start_time:      string
        end_time:        string
        notes?:          string
      }

    // Validate required fields
    if (!teacher_id || !availability_id || !scheduled_date || !start_time || !end_time) {
      return c.json(err('teacher_id, availability_id, scheduled_date, start_time, end_time are required'), 400)
    }

    // Validate date is not in the past
    if (new Date(scheduled_date) < new Date(new Date().toDateString())) {
      return c.json(err('Cannot book a date in the past'), 400)
    }

    // Verify availability slot exists and is active
    const slot = await availabilityService.findById(availability_id)
    if (!slot || !slot.is_active) {
      return c.json(err('Availability slot not found or inactive'), 404)
    }

    if (slot.teacher_id !== teacher_id) {
      return c.json(err('Slot does not belong to this teacher'), 400)
    }

    const booking = await bookingsService.create({
      student_id:      jwtUser.sub,
      teacher_id,
      availability_id,
      scheduled_date,
      start_time,
      end_time,
      student_notes: notes,
    })

    return c.json(ok(booking), 201)
  } catch (e: any) {
    console.error('[createBooking]', e.message)
    return c.json(err(e.message), 409)
  }
}

// GET /bookings  (role-aware)
export const listBookings = async (c: Context) => {
  const jwtUser = c.get('user')

  let bookings

  if (jwtUser.role === 'ADMIN') {
    bookings = await bookingsService.findAll()
  } else if (jwtUser.role === 'TEACHER') {
    const teacherProfile = await teachersService.findByUserId(jwtUser.sub)
    if (!teacherProfile) return c.json(err('Teacher profile not found'), 403)
    bookings = await bookingsService.findByTeacher(teacherProfile.id)
  } else {
    // STUDENT
    bookings = await bookingsService.findByStudent(jwtUser.sub)
  }

  return c.json(ok(bookings, { total: bookings.length }))
}

// PATCH /bookings/:id/status
export const updateStatus = async (c: Context) => {
  try {
    const jwtUser = c.get('user')
    const id = Number(c.req.param('id'))
    if (isNaN(id)) return c.json(err('Invalid booking id'), 400)

    const { status } = await c.req.json() as { status: BookingStatus }

    const validStatuses: BookingStatus[] = ['APPROVED', 'COMPLETED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return c.json(err(`status must be one of: ${validStatuses.join(', ')}`), 400)
    }

    // Resolve teacher_id if caller is a teacher
    let actorId = jwtUser.sub
    if (jwtUser.role === 'TEACHER') {
      const teacherProfile = await teachersService.findByUserId(jwtUser.sub)
      if (!teacherProfile) return c.json(err('Teacher profile not found'), 403)
      actorId = teacherProfile.id
    }

    const updated = await bookingsService.updateStatus(id, status, actorId, jwtUser.role)
    return c.json(ok(updated))
  } catch (e: any) {
    console.error('[updateStatus]', e.message)
    return c.json(err(e.message), 400)
  }
}

// PATCH /bookings/:id/notes  (teacher only)
export const addNotes = async (c: Context) => {
  try {
    const jwtUser = c.get('user')
    const id = Number(c.req.param('id'))
    if (isNaN(id)) return c.json(err('Invalid booking id'), 400)

    const { notes } = await c.req.json() as { notes: string }
    if (!notes?.trim()) return c.json(err('notes cannot be empty'), 400)

    const teacherProfile = await teachersService.findByUserId(jwtUser.sub)
    if (!teacherProfile) return c.json(err('Teacher profile not found'), 403)

    const updated = await bookingsService.addTeacherNotes(id, notes, teacherProfile.id)
    return c.json(ok(updated))
  } catch (e: any) {
    return c.json(err(e.message), 400)
  }
}

// GET /notifications/unread  (any authenticated user)
export const getUnreadNotifications = async (c: Context) => {
  const jwtUser = c.get('user')
  const notifs = await notifService.findUnread(jwtUser.sub)
  return c.json(ok(notifs, { total: notifs.length }))
}

// PATCH /notifications/read-all
export const markNotificationsRead = async (c: Context) => {
  const jwtUser = c.get('user')
  await notifService.markAllRead(jwtUser.sub)
  return c.json(ok({ message: 'All notifications marked as read' }))
}