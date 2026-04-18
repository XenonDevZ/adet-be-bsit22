import { Hono } from 'hono'
import {
  createBooking, listBookings, updateStatus, addNotes,
  getUnreadNotifications, getAllNotifications,
  markNotificationsRead, markNotificationRead,
  requestReschedule, respondReschedule,
} from '../controllers/bookings.controller.js'
import {
  uploadFile, getFiles, deleteFile, downloadFile,
} from '../controllers/files.controller.js'
import {
  submitFeedback, getFeedback,
} from '../controllers/feedback.controller.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireRole } from '../middleware/roleGuard.js'

export const bookingsRoutes = new Hono()

bookingsRoutes.use('*', authMiddleware)

// ── Bookings ──────────────────────────────────────────────
bookingsRoutes.post('/',
  requireRole('STUDENT'), createBooking)
bookingsRoutes.get('/',
  listBookings)
bookingsRoutes.patch('/:id/status',
  requireRole('STUDENT', 'TEACHER', 'ADMIN'), updateStatus)
bookingsRoutes.patch('/:id/notes',
  requireRole('TEACHER', 'ADMIN'), addNotes)
bookingsRoutes.patch('/:id/reschedule',
  requireRole('STUDENT'), requestReschedule)
bookingsRoutes.patch('/:id/reschedule-response',
  requireRole('TEACHER', 'ADMIN'), respondReschedule)

// ── Files ─────────────────────────────────────────────────
bookingsRoutes.post('/:id/files',
  uploadFile)
bookingsRoutes.get('/:id/files',
  getFiles)
bookingsRoutes.delete('/:id/files/:fileId',
  deleteFile)
bookingsRoutes.get('/:id/files/:fileId/download',
  downloadFile)

// ── Feedback ──────────────────────────────────────────────
bookingsRoutes.post('/:id/feedback',
  submitFeedback)
bookingsRoutes.get('/:id/feedback',
  getFeedback)

// ── Notifications ─────────────────────────────────────────
bookingsRoutes.get('/notifications/unread',
  getUnreadNotifications)
bookingsRoutes.get('/notifications/all',
  getAllNotifications)
bookingsRoutes.patch('/notifications/read-all',
  markNotificationsRead)
bookingsRoutes.patch('/notifications/:id/read',
  markNotificationRead)
import { db } from '../config/db.js'

bookingsRoutes.patch('/test-read-all/:id', async (c) => {
  const userId = Number(c.req.param('id'))
  const [result] = await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [userId])
  return c.json({ result })
})
