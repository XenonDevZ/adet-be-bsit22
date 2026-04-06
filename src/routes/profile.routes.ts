import { Hono } from 'hono'
import { getProfile, updateProfile } from '../controllers/profile.controller.js'
import { authMiddleware } from '../middleware/auth.js'

export const profileRoutes = new Hono()

profileRoutes.use('*', authMiddleware)

profileRoutes.get('/',  getProfile)
profileRoutes.patch('/', updateProfile)
