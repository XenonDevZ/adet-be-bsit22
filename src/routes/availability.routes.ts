import { Hono } from 'hono'
import { createSlot, getSlots, deleteSlot } from '../controllers/availability.controller.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireRole } from '../middleware/roleGuard.js'

export const availabilityRoutes = new Hono()

availabilityRoutes.use('*', authMiddleware)

// Any authenticated user can view slots
availabilityRoutes.get('/:teacherId', getSlots)

// Only teachers (or admins) can create/delete slots
availabilityRoutes.post('/',     requireRole('TEACHER', 'ADMIN'), createSlot)
availabilityRoutes.delete('/:id', requireRole('TEACHER', 'ADMIN'), deleteSlot)