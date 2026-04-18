import type { Context } from 'hono'
import * as feedbackService from '../services/feedback.service.js'
import * as bookingsService from '../services/bookings.service.js'
import * as teachersService from '../services/teachers.service.js'
import * as notifService from '../services/notification.service.js'
import { ok, err } from '../utils/response.js'
import { FeedbackSchema } from '../validators/index.js'

// POST /bookings/:id/feedback
export const submitFeedback = async (c: Context) => {
  try {
    const jwtUser = c.get('user')
    const id      = Number(c.req.param('id'))
    if (isNaN(id)) return c.json(err('Invalid booking id'), 400)

    const booking = await bookingsService.findById(id)
    if (!booking) return c.json(err('Booking not found'), 404)
    if (booking.status !== 'COMPLETED') {
      return c.json(err('Can only leave feedback on completed bookings'), 400)
    }

    const body   = await c.req.json()
    const parsed = FeedbackSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(err(parsed.error.errors[0].message), 400)
    }

    let reviewerId: number
    let revieweeId: number

    if (jwtUser.role === 'STUDENT') {
      // Student reviews teacher
      if (booking.student_id !== jwtUser.sub) {
        return c.json(err('Not your booking'), 403)
      }
      reviewerId = jwtUser.sub
      revieweeId = booking.teacher_user_id
    } else if (jwtUser.role === 'TEACHER') {
      // Teacher reviews student
      const tp = await teachersService.findByUserId(jwtUser.sub)
      if (!tp || booking.teacher_id !== tp.id) {
        return c.json(err('Not your booking'), 403)
      }
      reviewerId = jwtUser.sub
      revieweeId = booking.student_user_id
    } else {
      return c.json(err('Admins cannot submit feedback'), 403)
    }

    const feedback = await feedbackService.create({
      booking_id:  id,
      reviewer_id: reviewerId,
      reviewee_id: revieweeId,
      rating:      parsed.data.rating,
      comment:     parsed.data.comment,
    })

    // Notify reviewee (Student or Teacher)
    const reviewerName = jwtUser.name
    await notifService.create(
      revieweeId,
      id,
      `New feedback from ${reviewerName}: "${parsed.data.rating} Stars"`
    )

    // Notify admins
    await notifService.notifyAdmins(
      id,
      `${reviewerName} submitted feedback for booking #${id}`
    )

    return c.json(ok(feedback), 201)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to submit feedback'
    return c.json(err(message), 400)
  }
}

// GET /bookings/:id/feedback
export const getFeedback = async (c: Context) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json(err('Invalid booking id'), 400)
  const feedback = await feedbackService.findByBooking(id)
  return c.json(ok(feedback, { total: feedback.length }))
}
