import { Hono } from 'hono'
import {
  createBooking,
  listBookings,
  updateStatus,
  addNotes,
  getUnreadNotifications,
  getAllNotifications,
  markNotificationsRead,
  markNotificationRead,
  requestReschedule,
  respondReschedule,
} from '../controllers/bookings.controller.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireRole } from '../middleware/roleGuard.js'

export const bookingsRoutes = new Hono()

bookingsRoutes.use('*', authMiddleware)

// Bookings
bookingsRoutes.post('/',                        requireRole('STUDENT'),                    createBooking)
bookingsRoutes.get('/',                                                                    listBookings)
bookingsRoutes.patch('/:id/status',             requireRole('STUDENT', 'TEACHER', 'ADMIN'), updateStatus)
bookingsRoutes.patch('/:id/notes',              requireRole('TEACHER', 'ADMIN'),            addNotes)
bookingsRoutes.patch('/:id/reschedule',         requireRole('STUDENT'),                    requestReschedule)
bookingsRoutes.patch('/:id/reschedule-response',requireRole('TEACHER', 'ADMIN'),           respondReschedule)

// Notifications
bookingsRoutes.get('/notifications/unread',          getAllNotifications)
bookingsRoutes.get('/notifications/all',             getAllNotifications)
bookingsRoutes.patch('/notifications/read-all',      markNotificationsRead)
bookingsRoutes.patch('/notifications/:id/read',      markNotificationRead)
