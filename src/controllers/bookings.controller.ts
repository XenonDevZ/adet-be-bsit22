import type { Context } from 'hono'
import * as bookingsService from '../services/bookings.service.js'
import * as teachersService from '../services/teachers.service.js'
import * as availabilityService from '../services/availability.service.js'
import * as notifService from '../services/notification.service.js'
import { ok, err } from '../utils/response.js'
import {
  CreateBookingSchema,
  UpdateBookingStatusSchema,
  AddNotesSchema,
  RescheduleBookingSchema,
} from '../validators/index.js'

// POST /bookings  (student)
export const createBooking = async (c: Context) => {
  try {
    const jwtUser = c.get('user')
    const body    = await c.req.json()

    const parsed = CreateBookingSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(err(parsed.error.errors[0].message), 400)
    }

    const {
      teacher_id, availability_id, scheduled_date,
      start_time, end_time, consultation_type, notes
    } = parsed.data

    // Date must not be in the past
    if (new Date(scheduled_date) < new Date(new Date().toDateString())) {
      return c.json(err('Cannot book a date in the past'), 400)
    }

    // Verify slot exists and is active
    const slot = await availabilityService.findById(availability_id)
    if (!slot || !slot.is_active) {
      return c.json(err('Availability slot not found or inactive'), 404)
    }

    if (slot.teacher_id !== teacher_id) {
      return c.json(err('Slot does not belong to this teacher'), 400)
    }

    const booking = await bookingsService.create({
      student_id:        jwtUser.sub,
      teacher_id,
      availability_id,
      scheduled_date,
      start_time,
      end_time,
      consultation_type,
      student_notes:     notes,
    })

    return c.json(ok(booking), 201)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Booking failed'
    console.error('[createBooking]', message)
    return c.json(err(message), 409)
  }
}

// GET /bookings  (role-aware)
export const listBookings = async (c: Context) => {
  const jwtUser = c.get('user')

  if (jwtUser.role === 'ADMIN') {
    const bookings = await bookingsService.findAll()
    return c.json(ok(bookings, { total: bookings.length }))
  }

  if (jwtUser.role === 'TEACHER') {
    const teacherProfile = await teachersService.findByUserId(jwtUser.sub)
    if (!teacherProfile) return c.json(err('Teacher profile not found'), 403)
    const bookings = await bookingsService.findByTeacher(teacherProfile.id)
    return c.json(ok(bookings, { total: bookings.length }))
  }

  // STUDENT
  const bookings = await bookingsService.findByStudent(jwtUser.sub)
  return c.json(ok(bookings, { total: bookings.length }))
}

// PATCH /bookings/:id/status
export const updateStatus = async (c: Context) => {
  try {
    const jwtUser = c.get('user')
    const id      = Number(c.req.param('id'))
    if (isNaN(id)) return c.json(err('Invalid booking id'), 400)

    const body   = await c.req.json()
    const parsed = UpdateBookingStatusSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(err(parsed.error.errors[0].message), 400)
    }

    const { status } = parsed.data

    // Resolve actor id — teachers are identified by teacher profile id
    let actorId = jwtUser.sub
    if (jwtUser.role === 'TEACHER') {
      const teacherProfile = await teachersService.findByUserId(jwtUser.sub)
      if (!teacherProfile) return c.json(err('Teacher profile not found'), 403)
      actorId = teacherProfile.id
    }

    const updated = await bookingsService.updateStatus(id, status, actorId, jwtUser.role)
    return c.json(ok(updated))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to update status'
    console.error('[updateStatus]', message)
    return c.json(err(message), 400)
  }
}

// PATCH /bookings/:id/notes  (teacher only)
export const addNotes = async (c: Context) => {
  try {
    const jwtUser = c.get('user')
    const id      = Number(c.req.param('id'))
    if (isNaN(id)) return c.json(err('Invalid booking id'), 400)

    const body   = await c.req.json()
    const parsed = AddNotesSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(err(parsed.error.errors[0].message), 400)
    }

    const teacherProfile = await teachersService.findByUserId(jwtUser.sub)
    if (!teacherProfile) return c.json(err('Teacher profile not found'), 403)

    const updated = await bookingsService.addTeacherNotes(id, parsed.data.notes, teacherProfile.id)
    return c.json(ok(updated))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to add notes'
    return c.json(err(message), 400)
  }
}

// PATCH /bookings/:id/reschedule  (student)
export const requestReschedule = async (c: Context) => {
  try {
    const jwtUser = c.get('user')
    const id      = Number(c.req.param('id'))
    if (isNaN(id)) return c.json(err('Invalid booking id'), 400)

    const body   = await c.req.json()
    const parsed = RescheduleBookingSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(err(parsed.error.errors[0].message), 400)
    }

    const updated = await bookingsService.requestReschedule(id, jwtUser.sub, parsed.data)
    return c.json(ok(updated))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to request reschedule'
    return c.json(err(message), 400)
  }
}

// PATCH /bookings/:id/reschedule-response  (teacher)
export const respondReschedule = async (c: Context) => {
  try {
    const jwtUser = c.get('user')
    const id      = Number(c.req.param('id'))
    if (isNaN(id)) return c.json(err('Invalid booking id'), 400)

    const { accept } = await c.req.json() as { accept: boolean }
    if (typeof accept !== 'boolean') {
      return c.json(err('accept must be true or false'), 400)
    }

    const teacherProfile = await teachersService.findByUserId(jwtUser.sub)
    if (!teacherProfile) return c.json(err('Teacher profile not found'), 403)

    const updated = await bookingsService.respondReschedule(id, teacherProfile.id, accept)
    return c.json(ok(updated))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to respond to reschedule'
    return c.json(err(message), 400)
  }
}

// GET /notifications/unread
export const getUnreadNotifications = async (c: Context) => {
  const jwtUser = c.get('user')
  const notifs  = await notifService.findUnread(jwtUser.sub)
  return c.json(ok(notifs, { total: notifs.length }))
}

// GET /notifications/all
export const getAllNotifications = async (c: Context) => {
  const jwtUser = c.get('user')
  const notifs  = await notifService.findAll(jwtUser.sub)
  return c.json(ok(notifs, { total: notifs.length }))
}

// PATCH /notifications/read-all
export const markNotificationsRead = async (c: Context) => {
  const jwtUser = c.get('user')
  await notifService.markAllRead(jwtUser.sub)
  return c.json(ok({ message: 'All notifications marked as read' }))
}

// PATCH /notifications/:id/read
export const markNotificationRead = async (c: Context) => {
  const jwtUser = c.get('user')
  const id      = Number(c.req.param('id'))
  if (isNaN(id)) return c.json(err('Invalid notification id'), 400)
  await notifService.markRead(id, jwtUser.sub)
  return c.json(ok({ message: 'Marked as read' }))
}
