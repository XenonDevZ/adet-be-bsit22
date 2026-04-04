import { Hono } from 'hono'
import { listTeachers, getTeacher } from '../controllers/teachers.controller.js'
import { authMiddleware } from '../middleware/auth.js'

export const teachersRoutes = new Hono()

// All teacher routes require login (any role)
teachersRoutes.use('*', authMiddleware)

teachersRoutes.get('/',    listTeachers)
teachersRoutes.get('/:id', getTeacher)
