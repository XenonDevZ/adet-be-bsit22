import { Hono } from 'hono'
import { listUsers, changeRole, setDepartment } from '../controllers/users.controller.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireRole } from '../middleware/roleGuard.js'

export const usersRoutes = new Hono()

usersRoutes.use('*', authMiddleware)
usersRoutes.use('*', requireRole('ADMIN'))

usersRoutes.get('/',                 listUsers)
usersRoutes.patch('/:id/role',       changeRole)
usersRoutes.patch('/:id/department', setDepartment)