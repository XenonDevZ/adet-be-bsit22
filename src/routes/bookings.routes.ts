import { Hono } from 'hono'
import {
  createBooking,
  listBookings,
  updateStatus,
  addNotes,
  getUnreadNotifications,
  markNotificationsRead,
} from '../controllers/bookings.controller.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireRole } from '../middleware/roleGuard.js'

export const bookingsRoutes = new Hono()

bookingsRoutes.use('*', authMiddleware)

// Bookings
bookingsRoutes.post('/',               requireRole('STUDENT'),                createBooking)
bookingsRoutes.get('/',                                                        listBookings)   // role-aware inside controller
bookingsRoutes.patch('/:id/status',    requireRole('STUDENT', 'TEACHER', 'ADMIN'), updateStatus)
bookingsRoutes.patch('/:id/notes',     requireRole('TEACHER', 'ADMIN'),        addNotes)

// Notifications (scoped here for simplicity)
bookingsRoutes.get('/notifications/unread',   getUnreadNotifications)
bookingsRoutes.patch('/notifications/read-all', markNotificationsRead)